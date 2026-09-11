import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Link from 'flarum/common/components/Link';
import username from 'flarum/common/helpers/username';

import { openModal } from '../repliesState';

/**
 * The reply preview under a feed card.
 *
 * One bubble, showing the most recent reply, which costs nothing: the text
 * rides along on the discussion payload and its author is already included.
 * The link under it opens the whole conversation as a modal over the feed -
 * the way a social feed does it, and the reason the card never grows into a
 * page of its own.
 */
export default class CascadeReplies extends Component {
  view(vnode) {
    const discussion = vnode.attrs.discussion;
    const preview = discussion.cascadeLastReply();

    if (!preview) return null;

    // The opening post is not a reply, so the count of *replies* is one less
    // than the comment count, and the preview already shows one of them.
    const remaining = Math.max(0, discussion.commentCount() - 2);

    return (
      <div className="Cascade-replies">
        {this.previewBubble(discussion, preview)}

        {remaining > 0 && (
          <button type="button" className="Cascade-replies-more Button--ua-reset" onclick={() => openModal(discussion)}>
            {app.translator.trans('ernestdefoe-cascade.forum.row.view_replies', { count: remaining })}
          </button>
        )}
      </div>
    );
  }

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

  avatar(user) {
    if (!user) return <span className="Cascade-reply-avatar">{Avatar.component({ user: null })}</span>;

    return (
      <Link className="Cascade-reply-avatar" href={app.route.user(user)} tabindex="-1" aria-hidden="true">
        {Avatar.component({ user, title: '' })}
      </Link>
    );
  }
}
