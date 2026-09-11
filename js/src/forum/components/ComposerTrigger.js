import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import extractText from 'flarum/common/utils/extractText';

/**
 * The box at the top of the feed that opens the composer.
 *
 * It is a button, not a text field. Typing has to happen in Flarum's real
 * composer or drafts, uploads, mentions, previews and every editor extension
 * stop working — an input here that silently threw all that away would be the
 * most convincing-looking broken control in the theme.
 *
 * This is a Component subclass rather than a plain function on purpose. Mithril
 * treats a bare function passed to `m()` as a *closure component* and expects it
 * to return `{ view }`; returning a vnode instead makes Mithril call `.view` on
 * that vnode and throw "Cannot read properties of undefined (reading 'apply')"
 * from inside its render pass — where Flarum's extender try/catch cannot see it,
 * so the whole app dies on a spinner with nothing in the console but a Mithril
 * stack trace.
 */
export default class ComposerTrigger extends Component {
  view() {
    const user = app.session.user;
    const canStart = app.forum.attribute('canStartDiscussion') || !user;

    const label = extractText(
      app.translator.trans(
        canStart
          ? 'ernestdefoe-cascade.forum.composer.placeholder'
          : 'ernestdefoe-cascade.forum.composer.cannot_start'
      )
    );

    return (
      <div className="Cascade-composer">
        <div className="Cascade-composer-top">
          {Avatar.component({ user: user || null })}
          <button type="button" className="Cascade-composer-trigger" disabled={!canStart} onclick={start}>
            {label}
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Reuse core's own newDiscussionAction rather than reimplementing it: it opens
 * the login modal for a guest, and it knows how to lazy-load DiscussionComposer
 * out of core's chunk — something an extension cannot do by importing that
 * component itself.
 *
 * The method touches only `app`, never `this`, so calling it off the prototype
 * without an instance is safe. (Checked against rc.8; if core ever gives it
 * state, this needs a real instance instead.)
 */
function start() {
  return IndexSidebar.prototype.newDiscussionAction.call(null).catch(() => {});
}
