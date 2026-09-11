import app from 'flarum/forum/app';
import Modal from 'flarum/common/components/Modal';
import Avatar from 'flarum/common/components/Avatar';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import username from 'flarum/common/helpers/username';
import humanTime from 'flarum/common/utils/humanTime';
import DiscussionControls from 'flarum/forum/utils/DiscussionControls';

import MediaMosaic from './MediaMosaic';
import postContent from '../postContent';
import { replyState, load } from '../repliesState';

/**
 * The whole discussion, over the feed, without leaving it.
 *
 * This is what makes Cascade read as a social feed rather than as a forum with
 * social styling: opening a conversation is a modal over the timeline you were
 * already reading, not a navigation to a different page that loses your place.
 *
 * The discussion page still exists and still works - it is the permalink every
 * notification, search result and external link points at, and taking it away
 * would break all of them. The modal is the fast path, not a replacement.
 *
 * Data comes from the same `replyState` entry the card uses, so opening the
 * modal on a card whose text was already expanded costs no request at all.
 */
export default class DiscussionModal extends Modal {
  oninit(vnode) {
    super.oninit(vnode);

    this.discussion = this.attrs.discussion;

    load(this.discussion).catch(() => {});
  }

  className() {
    return 'Cascade-modal Modal--large';
  }

  title() {
    // "Ethan's post", not the discussion title. The title is already the first
    // thing inside the modal; repeating it in the header wastes the one line
    // that tells you whose conversation you just opened.
    //
    // The User MODEL is passed as `user`, not a rendered name: Flarum's
    // translator treats that parameter specially - it extracts it and calls
    // username() on it to fill `{username}`. Handing it an already-rendered
    // name makes it call displayName() on a vnode, which throws from inside
    // the modal's own render and leaves the modal stuck on a spinner.
    return app.translator.trans('ernestdefoe-cascade.forum.modal.title', {
      user: this.discussion.user(),
    });
  }

  content() {
    const state = replyState(this.discussion.id());

    return (
      <div className="Modal-body Cascade-modal-body">
        {this.openingPost(state)}
        {this.replies(state)}
        {this.footer()}
      </div>
    );
  }

  openingPost(state) {
    const discussion = this.discussion;
    const user = discussion.user();

    return (
      <article className="Cascade-modal-post">
        <h3 className="Cascade-modal-title">{discussion.title()}</h3>

        <header className="Cascade-modal-author">
          {user ? (
            <Link href={app.route.user(user)}>{Avatar.component({ user, title: '' })}</Link>
          ) : (
            Avatar.component({ user: null })
          )}
          <div>
            <div className="Cascade-author-name">
              {user ? <Link href={app.route.user(user)}>{username(user)}</Link> : username(user)}
            </div>
            <div className="Cascade-author-sub">{humanTime(discussion.createdAt())}</div>
          </div>
        </header>

        {state.loading && !state.firstPost ? (
          <LoadingIndicator display="block" />
        ) : state.firstPost ? (
          <div className="Cascade-post">{m.trust(postContent(state.firstPost.contentHtml()))}</div>
        ) : (
          // The excerpt is always in hand, so a slow request shows the post's
          // opening instead of an empty box.
          <p className="Cascade-excerpt">{discussion.cascadeExcerpt()}</p>
        )}

        {/* Images after the words, the way a social post reads: the text is
            the caption, the pictures are what it is captioning. */}
        {discussion.cascadeImages && (discussion.cascadeImages() || []).length > 0 && (
          <MediaMosaic discussion={discussion} interactive={false} />
        )}
      </article>
    );
  }

  replies(state) {
    if (state.loading) {
      return <LoadingIndicator display="block" />;
    }

    if (!state.posts.length) {
      return (
        <p className="Cascade-modal-empty">
          {app.translator.trans('ernestdefoe-cascade.forum.modal.no_replies')}
        </p>
      );
    }

    return (
      <div className="Cascade-modal-replies">
        <h4 className="Cascade-modal-repliesTitle">
          {app.translator.trans('ernestdefoe-cascade.forum.modal.replies_title', { count: state.posts.length })}
        </h4>

        {state.posts.map((post) => {
          const user = post.user();

          return (
            <div className="Cascade-reply" key={post.id()}>
              {user ? (
                <Link className="Cascade-reply-avatar" href={app.route.user(user)}>
                  {Avatar.component({ user, title: '' })}
                </Link>
              ) : (
                <span className="Cascade-reply-avatar">{Avatar.component({ user: null })}</span>
              )}

              <div className="Cascade-reply-bubble">
                <div className="Cascade-reply-head">
                  <span className="Cascade-reply-name">{username(user)}</span>
                  <span className="Cascade-reply-time">{humanTime(post.createdAt())}</span>
                </div>
                <div className="Cascade-reply-body">{m.trust(postContent(post.contentHtml()))}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  footer() {
    return (
      <footer className="Cascade-modal-footer">
        <Button className="Button Button--primary" icon="fas fa-reply" onclick={() => this.reply()}>
          {app.translator.trans('ernestdefoe-cascade.forum.modal.reply_button')}
        </Button>

        {/* The permalink. A modal has no URL of its own, so this is how someone
            gets a link to the conversation, and how search engines and
            notifications keep working. */}
        <Link className="Cascade-modal-permalink" href={app.route.discussion(this.discussion)} onclick={() => this.hide()}>
          <Icon name="fas fa-arrow-up-right-from-square" />
          {app.translator.trans('ernestdefoe-cascade.forum.modal.open_full')}
        </Link>
      </footer>
    );
  }

  /**
   * Reply through core's own control, which handles permissions, the
   * logged-out case and loading the composer chunk.
   *
   * The modal closes first: Flarum's composer docks to the bottom of the
   * window, underneath the modal backdrop, so leaving the modal open would
   * park the user in front of a composer they cannot see.
   */
  reply() {
    const discussion = this.discussion;

    this.hide();

    DiscussionControls.replyAction.call(discussion, true, false).catch(() => {});
  }
}
