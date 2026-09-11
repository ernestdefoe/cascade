import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import username from 'flarum/common/helpers/username';
import humanTime from 'flarum/common/utils/humanTime';

import { replyState, expand, collapse } from '../repliesState';

/**
 * The replies shown under a feed card.
 *
 * Collapsed it previews the most recent reply, which costs nothing: the text
 * rides along on the discussion payload and the author is already included.
 * Expanded it loads the real posts and shows the whole conversation in place,
 * the way a social card does.
 *
 * State lives in the module-level `replyState` map rather than on the instance
 * because DiscussionListItem freezes its subtree behind a SubtreeRetainer: a
 * component nested inside it can set `this.x` and call m.redraw() all it likes
 * and the DOM will never follow. decorateRow adds a retainer check that watches
 * that map's version counter, which is what actually lets these updates paint.
 */
export default class CascadeReplies extends Component {
  view(vnode) {
    const discussion = vnode.attrs.discussion;
    const state = replyState(discussion.id());
    const replyCount = Math.max(0, discussion.commentCount() - 1);

    if (state.expanded) {
      return (
        <div className="Cascade-replies">
          {state.loading ? (
            <LoadingIndicator display="block" size="small" />
          ) : (
            state.posts.map((post) => this.bubble(post))
          )}

          {!state.loading && (
            <button type="button" className="Cascade-replies-more Button--ua-reset" onclick={() => collapse(discussion)}>
              {app.translator.trans('ernestdefoe-cascade.forum.row.hide_replies')}
            </button>
          )}
        </div>
      );
    }

    const preview = discussion.cascadeLastReply();

    if (!preview) return null;

    return (
      <div className="Cascade-replies">
        {this.previewBubble(discussion, preview)}

        {replyCount > 1 && (
          <button type="button" className="Cascade-replies-more Button--ua-reset" onclick={() => expand(discussion)}>
            {app.translator.trans('ernestdefoe-cascade.forum.row.view_replies', { count: replyCount - 1 })}
          </button>
        )}
      </div>
    );
  }

  /**
   * The collapsed preview, built from data already on the discussion.
   */
  previewBubble(discussion, text) {
    const user = discussion.lastPostedUser();

    return (
      <div className="Cascade-reply">
        {this.avatar(user)}
        <div className="Cascade-reply-bubble">
          <div className="Cascade-reply-name">{username(user)}</div>
          <p className="Cascade-reply-text">{text}</p>
        </div>
      </div>
    );
  }

  /**
   * A fully loaded reply.
   *
   * `contentHtml` is rendered by Flarum's own formatter on the server - the
   * same string the post stream displays - so it is trusted here for exactly
   * the reason core trusts it there. Anything a user typed has already been
   * through the formatter's sanitisation.
   */
  bubble(post) {
    const user = post.user();

    return (
      <div className="Cascade-reply" key={post.id()}>
        {this.avatar(user)}
        <div className="Cascade-reply-bubble">
          <div className="Cascade-reply-head">
            <span className="Cascade-reply-name">{username(user)}</span>
            <span className="Cascade-reply-time">{humanTime(post.createdAt())}</span>
          </div>
          <div className="Cascade-reply-body">{m.trust(post.contentHtml() || '')}</div>
        </div>
      </div>
    );
  }

  avatar(user) {
    if (!user) return <span className="Cascade-reply-avatar">{Avatar.component({ user: null })}</span>;

    return (
      <Link className="Cascade-reply-avatar" href={app.route.user(user)} tabindex="-1" aria-hidden="true">
        {Avatar.component({ user, title: '' })}
      </Link>
    );
  }

}
