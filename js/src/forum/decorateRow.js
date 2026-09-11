import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import username from 'flarum/common/helpers/username';
import humanTime from 'flarum/common/utils/humanTime';

import CascadeReplies from './components/CascadeReplies';
import ReactionControl from './components/ReactionControl';
import { setting } from './settings';
import { replyState, expand, version } from './repliesState';
import { reactionById, reactionGlyph } from './reactions';

/**
 * Turn core's discussion list row into a feed card.
 *
 * This ADDS to DiscussionListItem's ItemLists rather than replacing the
 * component. Core's own items — the author column, the title, the info line
 * (where flarum/tags puts its labels and core puts the terminal post), the
 * stats — all stay where they are, which is what lets tags, best-answer,
 * sticky, locked and every other list decorator keep working untouched.
 *
 * The row becomes a two-column grid: the avatar in column one, everything
 * else in column two. Wall lets the content run full width under the avatar;
 * Timeline has the avatar span every row. Both live in the preset stylesheets.
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

      if (body) {
        items.add('cascadeBody', body, 75);
      }
    }

    const summary = reactionSummary(discussion);

    if (summary) {
      // 71 puts it directly before core's stats item (70), which is what
      // lets the two share one line - see feed/engagement.less.
      items.add('cascadeReactionSummary', summary, 71);
    }

    items.add('cascadeEngagement', engagementView(discussion), 60);

    items.add('cascadeReplies', <CascadeReplies discussion={discussion} />, 55);
  });

  // The row must repaint when its like/reply counts change, and
  // DiscussionListItem freezes its own subtree behind a SubtreeRetainer keyed
  // on `discussion.freshness`. Anything Cascade renders that can change
  // without a freshness bump has to be declared to that retainer, or the state
  // updates and the DOM never follows — which looks exactly like an unwired
  // control.
  extend('flarum/forum/components/DiscussionListItem', 'oninit', function () {
    this.subtree.check(
      () => this.attrs.discussion.cascadeExcerpt(),
      () => this.attrs.discussion.cascadeLastReply(),
      () => this.attrs.discussion.commentCount(),
      () => this.attrs.discussion.cascadeUserReaction(),
      // Expanding or collapsing replies changes nothing the retainer would
      // otherwise notice, so the state module exposes a counter for it.
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
 * The body of the card.
 *
 * Collapsed, this is the server-computed excerpt plus one image - cheap enough
 * to render twenty of. Once the card is expanded it becomes the real opening
 * post, rendered exactly as the discussion page renders it, images and all.
 * Expanding the replies while leaving the post itself clipped at 280
 * characters reads backwards: you would be reading answers to something you
 * cannot see.
 */
function bodyView(discussion, density) {
  const state = replyState(discussion.id());

  if (state.expanded && state.firstPost) {
    return (
      <div className="Cascade-body Cascade-body--full">
        <div className="Cascade-post">{m.trust(state.firstPost.contentHtml() || '')}</div>
      </div>
    );
  }

  const excerpt = discussion.cascadeExcerpt();
  const image = density === 'excerpt_media' ? discussion.cascadeImage() : null;

  if (!excerpt && !image) return null;

  // The backend appends an ellipsis only when it actually cut something, so
  // this is a reliable "there is more to read" signal rather than a guess.
  const truncated = typeof excerpt === 'string' && excerpt.endsWith('…');

  return (
    <div className="Cascade-body">
      {excerpt ? <p className="Cascade-excerpt">{excerpt}</p> : null}

      {truncated && (
        <button type="button" className="Cascade-seeMore Button--ua-reset" onclick={() => expand(discussion)}>
          {app.translator.trans('ernestdefoe-cascade.forum.row.see_more')}
        </button>
      )}

      {image ? mediaView(discussion, image) : null}
    </div>
  );
}

function mediaView(discussion, image) {
  const count = discussion.cascadeImageCount() || 1;

  return (
    <Link className="Cascade-media" href={app.route.discussion(discussion)} tabindex="-1" aria-hidden="true">
      {/* Decorative: the discussion title already names the link, and alt text
          repeating it would be read twice. loading=lazy matters here — a page
          of twenty rows is otherwise twenty full-size images at once. */}
      <img src={image} alt="" loading="lazy" decoding="async" />
      {count > 1 ? <span className="Cascade-media-more">+{count - 1}</span> : null}
    </Link>
  );
}

/**
 * The feed row's engagement bar.
 *
 * The reaction control appears only when fof/reactions is enabled, because
 * that is the only case where `cascadeFirstPostId` exists to act on. Cascade
 * ships no reactions of its own, and a reaction button with nothing behind it
 * would be worse than no button at all.
 */
function engagementView(discussion) {
  const canReact = Boolean(discussion.cascadeFirstPostId && discussion.cascadeFirstPostId());

  return (
    <div className="Cascade-engagement">
      {canReact && <ReactionControl discussion={discussion} />}

      <Link className="Cascade-engagement-action" data-cs-action="reply" href={app.route.discussion(discussion)}>
        <Icon name="far fa-comment" />
        <span className="Cascade-engagement-label">
          {app.translator.trans('ernestdefoe-cascade.forum.row.reply_button')}
        </span>
      </Link>

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
    </div>
  );
}

/**
 * The stacked reaction pips and total that sit above the divider - the row a
 * social card shows over its action bar. Rendered only when somebody has
 * actually reacted, so a quiet discussion gets no empty strip.
 */
function reactionSummary(discussion) {
  const counts = discussion.cascadeReactionCounts && discussion.cascadeReactionCounts();

  if (!counts) return null;

  const entries = Object.keys(counts)
    .map((id) => ({ reaction: reactionById(id), count: counts[id] }))
    .filter((e) => e.reaction && e.count > 0)
    .sort((a, b) => b.count - a.count);

  if (!entries.length) return null;

  const total = entries.reduce((n, e) => n + e.count, 0);

  return (
    <div className="Cascade-reactSummary">
      <span className="Cascade-reactSummary-pips" aria-hidden="true">
        {entries.slice(0, 3).map((e) => (
          <span className="Cascade-reactSummary-pip" key={e.reaction.id()}>
            {reactionGlyph(e.reaction)}
          </span>
        ))}
      </span>
      <span className="Cascade-reactSummary-count">{total}</span>
    </div>
  );
}

/**
 * Copy the discussion's permalink. `navigator.clipboard` needs a secure
 * context, which a forum served over plain HTTP is not — so a failure falls
 * back to prompting with the URL rather than silently doing nothing.
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
