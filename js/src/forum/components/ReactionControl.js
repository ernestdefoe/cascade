import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';

import { bump } from '../repliesState';
import { reactionTypes, reactionById, reactionGlyph, reactionLabel, sendReaction } from '../reactions';

/**
 * The reaction control on a feed card: one button, and the picker that opens
 * over it.
 *
 * Behaviour is modelled on Facebook's, because that is the interaction people
 * already know:
 *
 *   - Hovering the button opens the picker after a short delay, so a pointer
 *     crossing the bar on its way somewhere else does not fire it.
 *   - Leaving closes it after a longer delay, so the trip from the button up
 *     to the emoji does not lose it mid-move.
 *   - Clicking the button applies (or clears) the default reaction, without
 *     ever opening the picker - the common case stays one click.
 *   - On touch there is no hover, so the button opens the picker on a long
 *     press and reacts on a tap.
 *
 * Open/close state is local to the instance, but every repaint goes through
 * `bump()`: DiscussionListItem freezes its subtree behind a SubtreeRetainer,
 * so a plain m.redraw() here would change nothing on screen.
 */
export default class ReactionControl extends Component {
  oninit(vnode) {
    super.oninit(vnode);

    this.open = false;
    this.openTimer = null;
    this.closeTimer = null;
    this.pressTimer = null;
  }

  onremove() {
    this.clearTimers();
  }

  view(vnode) {
    const discussion = vnode.attrs.discussion;
    const current = reactionById(discussion.cascadeUserReaction());
    const types = reactionTypes();

    if (!types.length) return null;

    return (
      <div
        className={'Cascade-react' + (this.open ? ' Cascade-react--open' : '')}
        onmouseenter={() => this.scheduleOpen()}
        onmouseleave={() => this.scheduleClose()}
      >
        {this.open && this.picker(discussion, types, current)}

        <button
          type="button"
          className={
            'Cascade-engagement-action Cascade-react-button Button--ua-reset' +
            (current ? ' Cascade-engagement-action--active' : '')
          }
          data-cs-action="react"
          data-cs-reaction={current ? current.identifier() : ''}
          aria-haspopup="true"
          aria-expanded={this.open ? 'true' : 'false'}
          onclick={() => this.toggleDefault(discussion, current, types)}
          ontouchstart={() => this.schedulePress()}
          ontouchend={() => this.cancelPress()}
          ontouchcancel={() => this.cancelPress()}
        >
          {current ? (
            <span className="Cascade-react-glyph" aria-hidden="true">
              {reactionGlyph(current)}
            </span>
          ) : (
            <Icon name="far fa-thumbs-up" />
          )}
          <span className="Cascade-engagement-label">
            {current ? reactionLabel(current) : app.translator.trans('ernestdefoe-cascade.forum.row.react_button')}
          </span>
        </button>
      </div>
    );
  }

  picker(discussion, types, current) {
    return (
      <div className="Cascade-reactPicker" role="menu">
        {types.map((reaction, i) => (
          <button
            type="button"
            key={reaction.id()}
            role="menuitem"
            className={
              'Cascade-reactOption Button--ua-reset' +
              (current && current.id() === reaction.id() ? ' Cascade-reactOption--active' : '')
            }
            // The stagger is what makes the row unfurl rather than appear.
            // Inline because it is per-index data, not a style decision.
            style={{ animationDelay: i * 32 + 'ms' }}
            title={reactionLabel(reaction)}
            aria-label={reactionLabel(reaction)}
            onclick={() => this.choose(discussion, reaction, current)}
          >
            <span className="Cascade-reactOption-glyph" aria-hidden="true">
              {reactionGlyph(reaction)}
            </span>
            <span className="Cascade-reactOption-label" aria-hidden="true">
              {reactionLabel(reaction)}
            </span>
          </button>
        ))}
      </div>
    );
  }

  /**
   * Clicking the button itself: apply the first reaction, or clear the one
   * already applied. This is the path most clicks take, so it never opens the
   * picker.
   */
  toggleDefault(discussion, current, types) {
    this.closeNow();
    this.apply(discussion, current ? null : types[0], current);
  }

  choose(discussion, reaction, current) {
    this.closeNow();

    // Picking the reaction you already have removes it, the way it does on
    // Facebook - otherwise there would be no way to undo from the picker.
    const next = current && current.id() === reaction.id() ? null : reaction;

    this.apply(discussion, next, current);
  }

  /**
   * Optimistic: the card updates immediately and the request follows, because
   * a reaction that waits for a round trip feels broken. A failure restores
   * exactly what was there before rather than leaving the UI claiming
   * something that did not happen.
   */
  apply(discussion, reaction, current) {
    if (!app.session.user) {
      app.modal.show(() => import('flarum/forum/components/LogInModal'));
      return;
    }

    const postId = discussion.cascadeFirstPostId();

    if (!postId) return;

    const previousId = discussion.cascadeUserReaction();
    const previousCounts = { ...(discussion.cascadeReactionCounts() || {}) };
    const counts = { ...previousCounts };

    if (current) {
      counts[current.id()] = Math.max(0, (counts[current.id()] || 1) - 1);
      if (!counts[current.id()]) delete counts[current.id()];
    }

    if (reaction) {
      counts[reaction.id()] = (counts[reaction.id()] || 0) + 1;
    }

    discussion.pushAttributes({
      cascadeUserReaction: reaction ? Number(reaction.id()) : null,
      cascadeReactionCounts: counts,
    });
    bump();

    sendReaction(postId, reaction ? reaction.id() : null).catch(() => {
      discussion.pushAttributes({
        cascadeUserReaction: previousId,
        cascadeReactionCounts: previousCounts,
      });
      bump();
      app.alerts.show({ type: 'error' }, app.translator.trans('ernestdefoe-cascade.forum.row.react_failed'));
    });
  }

  scheduleOpen() {
    clearTimeout(this.closeTimer);
    clearTimeout(this.openTimer);
    this.openTimer = setTimeout(() => {
      this.open = true;
      bump();
    }, 320);
  }

  scheduleClose() {
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      this.open = false;
      bump();
    }, 420);
  }

  /** Touch has no hover, so a long press stands in for it. */
  schedulePress() {
    clearTimeout(this.pressTimer);
    this.pressTimer = setTimeout(() => {
      this.open = true;
      bump();
    }, 350);
  }

  cancelPress() {
    clearTimeout(this.pressTimer);
  }

  closeNow() {
    this.clearTimers();
    this.open = false;
    bump();
  }

  clearTimers() {
    clearTimeout(this.openTimer);
    clearTimeout(this.closeTimer);
    clearTimeout(this.pressTimer);
  }
}
