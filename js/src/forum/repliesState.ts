import app from 'flarum/forum/app';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';

/**
 * Per-discussion state for the feed cards.
 *
 * This lives at module scope rather than on a component instance for a
 * structural reason: DiscussionListItem guards its own updates with a
 * SubtreeRetainer, so every component rendered inside a row is frozen along
 * with it. A nested component that keeps state in `this` can change that state
 * and call m.redraw() forever without the DOM ever changing.
 *
 * The retainer only rebuilds when one of its watched callbacks returns a new
 * value, so Cascade gives it something to watch: `version`, bumped on every
 * state change. decorateRow registers `() => version()` as a retainer check.
 */
export interface ReplyState {
  showFullPost: boolean;
  loading: boolean;
  loaded: boolean;
  posts: Post[];
  firstPost: Post | null;
}

const states = new Map<string | undefined, ReplyState>();
let v = 0;

/**
 * State for one discussion, created on first use.
 *
 * `showFullPost` and the loaded posts are deliberately separate. "See more"
 * expands the opening post in place; the reply link opens the modal. Both need
 * the same request, neither should trigger the other's UI.
 */
export function replyState(id: string | undefined): ReplyState {
  let state = states.get(id);

  if (!state) {
    state = { showFullPost: false, loading: false, loaded: false, posts: [], firstPost: null };
    states.set(id, state);
  }

  return state;
}

/** Tell every row's SubtreeRetainer that something changed. */
export function bump(): void {
  v++;
  m.redraw();
}

/** The value the retainer watches. */
export function version(): number {
  return v;
}

/**
 * Fetch the discussion's posts.
 *
 * One request serves both callers. `filter[discussion]` sorted by number
 * returns the opening post first, so the same payload that carries the replies
 * also carries the full text of the post the card was showing a truncated
 * excerpt of.
 *
 * Always resolves, with the state. A failure shows its own alert and leaves
 * `state.loaded` false, so callers check that rather than catching.
 */
export function load(discussion: Discussion): Promise<ReplyState> {
  const state = replyState(discussion.id());

  // Fetched once per discussion per page view. Re-opening reuses what is
  // already in hand rather than asking again for a conversation that has not
  // moved.
  if (state.loaded || state.loading) {
    return Promise.resolve(state);
  }

  state.loading = true;
  bump();

  return app.store
    .find<Post[]>('posts', {
      filter: { discussion: discussion.id() },
      page: { limit: 50 },
      sort: 'number',
    })
    .then((posts) => {
      const comments = posts.filter((post) => post.contentType() === 'comment');

      state.firstPost = comments.find((post) => post.number() === 1) || null;
      // Event posts (renames, tag changes, locks) are not replies, and neither
      // is the opening post.
      state.posts = comments.filter((post) => post.number() !== 1);
      state.loading = false;
      state.loaded = true;
      bump();

      return state;
    })
    .catch(() => {
      state.loading = false;
      bump();
      app.alerts.show({ type: 'error' }, app.translator.trans('ernestdefoe-cascade.forum.row.replies_failed'));

      return state;
    });
}

/**
 * "See more": show the whole opening post in the card, in place.
 */
export function seeMore(discussion: Discussion): Promise<ReplyState> {
  replyState(discussion.id()).showFullPost = true;
  bump();

  // On a failure load() has already shown the alert; this only collapses the
  // card again.
  return load(discussion).then((state) => {
    if (!state.loaded && !state.loading) {
      state.showFullPost = false;
      bump();
    }

    return state;
  });
}

/**
 * "See less": collapse the post's text back to its excerpt. The loaded posts
 * stay in hand, so re-expanding is instant.
 */
export function seeLess(discussion: Discussion): void {
  replyState(discussion.id()).showFullPost = false;
  bump();
}

/**
 * Open the conversation as a modal over the feed.
 *
 * Facebook's model: the comment link does not navigate, it lifts the post over
 * the timeline you were reading. The loader starts first so the modal opens
 * with data already arriving rather than after it.
 */
export function openModal(discussion: Discussion): void {
  // The modal shows the excerpt until the post arrives, and load() reports a
  // failure itself, so the promise is not waited on.
  void load(discussion);

  app.modal.show(() => import('./components/DiscussionModal'), { discussion });
}
