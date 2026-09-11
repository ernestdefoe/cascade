import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import username from 'flarum/common/helpers/username';
import humanTime from 'flarum/common/utils/humanTime';

import CascadeReplies from './components/CascadeReplies';
import MediaMosaic from './components/MediaMosaic';
import ReactionControl from './components/ReactionControl';
import { postPlainText } from './postContent';
import { reactionById, reactionGlyph } from './reactions';
import { replyState, seeMore, seeLess, openModal, version } from './repliesState';
import { setting } from './settings';

/**
 * Turn core's discussion list row into a feed card.
 *
 * This ADDS to DiscussionListItem's ItemLists rather than replacing the
 * component. Core's own items - the author column, the title, the info line
 * (where flarum/tags puts its labels and core puts the terminal post), the
 * stats - all stay where they are, which is what lets tags, best-answer,
 * sticky, locked and every other list decorator keep working untouched.
 *
 * The row becomes a two-column grid: the avatar in column one, everything else
 * in column two. Which rows sit beside the avatar is the presets' business;
 * see less/presets/.
 */
export default function decorateRow() {
  // String path rather than a prototype reference: core's `extend()` resolves
  // it through flarum.reg.onLoad, so this keeps working if DiscussionListItem
  // ever moves into an async chunk. It costs nothing today.
  extend('flarum/forum/components/DiscussionListItem', 'contentItems', function (items) {
    const discussion = this.attrs.discussion;
    const density = setting('feed_density');

    items.add('cascadeAvatar', avatarView(discussion), 99);
    items.add('cascadeAuthor', authorView(discussion), 90);

    if (density !== 'title') {
      const body = bodyView(discussion, density);

      if (body) items.add('cascadeBody', body, 75);
    }

    items.add('cascadeEngagement', engagementView(discussion), 60);
    items.add('cascadeReplies', <CascadeReplies discussion={discussion} />, 55);
  });

  // The row must repaint when any of this changes, and DiscussionListItem
  // freezes its own subtree behind a SubtreeRetainer keyed on
  // `discussion.freshness`. Anything Cascade renders that can change without a
  // freshness bump has to be declared to that retainer, or the state updates
  // and the DOM never follows - which looks exactly like an unwired control.
  extend('flarum/forum/components/DiscussionListItem', 'oninit', function () {
    this.subtree.check(
      () => this.attrs.discussion.cascadeExcerpt(),
      () => this.attrs.discussion.cascadeLastReply(),
      () => this.attrs.discussion.commentCount(),
      () => this.attrs.discussion.cascadeUserReaction(),
      () => version()
    );
  });
}

function avatarView(discussion) {
  const user = discussion.user();

  if (!user) {
    return <span className="Cascade-avatar">{Avatar.component({ user: null })}</span>;
  }

  return (
    <Link className="Cascade-avatar" href={app.route.user(user)} aria-hidden="true" tabindex="-1">
      {Avatar.component({ user, title: '' })}
    </Link>
  );
}

function authorView(discussion) {
  const user = discussion.user();

  return (
    <div className="Cascade-author">
      <div className="Cascade-author-meta">
        <div className="Cascade-author-name">
          {user ? <Link href={app.route.user(user)}>{username(user)}</Link> : username(user)}
        </div>
        <div className="Cascade-author-sub">{humanTime(discussion.createdAt())}</div>
      </div>
    </div>
  );
}

/**
 * The body of the card: the post's text, then its images.
 *
 * "See more" sits INLINE at the end of the truncated text rather than on a line
 * of its own - it is the continuation of the sentence it interrupts, and giving
 * it its own row reads as a separate control.
 *
 * It expands the text and nothing else. Deliberately the post's PLAIN text, not
 * its rendered HTML: rendering the real post here would bring its own inline
 * images and formatting with it and replace the card's mosaic, so a card
 * showing five tiled photos would suddenly be showing raw markup instead.
 * Expanding grows what is already there; it does not exchange it for something
 * else. (The modal does show the real rendered post - there, that is the point.)
 */
function bodyView(discussion, density) {
  const state = replyState(discussion.id());
  const full = state.showFullPost && state.firstPost ? postPlainText(state.firstPost.contentHtml()) : null;

  const excerpt = discussion.cascadeExcerpt();
  const text = full || excerpt;
  const images = (discussion.cascadeImages && discussion.cascadeImages()) || [];
  const hasMedia = density === 'excerpt_media' && images.length > 0;

  if (!text && !hasMedia) return null;

  // The backend appends an ellipsis only when it actually cut something, so
  // this is a reliable "there is more to read" signal rather than a guess.
  const truncated = typeof excerpt === 'string' && excerpt.endsWith('…');

  return (
    <div className="Cascade-body">
      {text ? (
        <p className={'Cascade-excerpt' + (full ? ' Cascade-excerpt--full' : '')}>
          {text}

          {truncated && !full && (
            <button type="button" className="Cascade-seeMore Button--ua-reset" onclick={() => seeMore(discussion)}>
              {state.loading
                ? app.translator.trans('ernestdefoe-cascade.forum.row.see_more_loading')
                : app.translator.trans('ernestdefoe-cascade.forum.row.see_more')}
            </button>
          )}

          {full && (
            <button type="button" className="Cascade-seeMore Button--ua-reset" onclick={() => seeLess(discussion)}>
              {app.translator.trans('ernestdefoe-cascade.forum.row.see_less')}
            </button>
          )}
        </p>
      ) : null}

      {hasMedia ? <MediaMosaic discussion={discussion} /> : null}
    </div>
  );
}

/**
 * The feed row's engagement bar.
 *
 * Shaped like a social card's: each action carries its own count, and the
 * stacked reaction pips sit at the right-hand end of the same row rather than
 * on a strip above it.
 *
 * The reaction control appears only when fof/reactions is enabled, because that
 * is the only case where `cascadeFirstPostId` exists to act on. Cascade ships no
 * reactions of its own, and a reaction button with nothing behind it would be
 * worse than no button at all.
 */
function engagementView(discussion) {
  const canReact = Boolean(discussion.cascadeFirstPostId && discussion.cascadeFirstPostId());
  const replies = Math.max(0, discussion.commentCount() - 1);

  return (
    <div className="Cascade-engagement">
      {canReact && <ReactionControl discussion={discussion} />}

      <button
        type="button"
        className="Cascade-engagement-action Button--ua-reset"
        data-cs-action="reply"
        onclick={() => openModal(discussion)}
      >
        <Icon name="far fa-comment" />
        <span className="Cascade-engagement-label">
          {app.translator.trans('ernestdefoe-cascade.forum.row.reply_button')}
        </span>
        {replies > 0 && <span className="Cascade-engagement-count">{replies}</span>}
      </button>

      <button
        type="button"
        className="Cascade-engagement-action Button--ua-reset"
        data-cs-action="share"
        onclick={(e) => share(e, discussion)}
      >
        <Icon name="fas fa-share-from-square" />
        <span className="Cascade-engagement-label">
          {app.translator.trans('ernestdefoe-cascade.forum.row.share_button')}
        </span>
      </button>

      {reactionPips(discussion)}
    </div>
  );
}

/**
 * The stacked reaction emoji at the right end of the bar. Rendered only when
 * somebody has actually reacted, so a quiet discussion gets no empty space.
 */
function reactionPips(discussion) {
  const counts = discussion.cascadeReactionCounts && discussion.cascadeReactionCounts();

  if (!counts) return null;

  const entries = Object.keys(counts)
    .map((id) => ({ reaction: reactionById(id), count: counts[id] }))
    .filter((e) => e.reaction && e.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!entries.length) return null;

  const total = entries.reduce((n, e) => n + e.count, 0);

  return (
    <span className="Cascade-reactPips">
      {entries.slice(0, 3).map((e) => (
        <span className="Cascade-reactPip" key={e.reaction.id()} aria-hidden="true">
          {reactionGlyph(e.reaction)}
        </span>
      ))}
      <span className="Cascade-reactPips-count">{total}</span>
    </span>
  );
}

/**
 * Copy the discussion's permalink.
 *
 * `navigator.clipboard` needs a secure context, which a forum served over plain
 * HTTP is not - so a failure falls back to prompting with the URL rather than
 * silently doing nothing.
 */
function share(e, discussion) {
  e.preventDefault();
  e.stopPropagation();

  const url = app.forum.attribute('baseUrl') + app.route.discussion(discussion);

  const copied = () =>
    app.alerts.show({ type: 'success' }, app.translator.trans('ernestdefoe-cascade.forum.row.share_copied'));

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(copied, () => window.prompt('', url));
  } else {
    window.prompt('', url);
  }
}
