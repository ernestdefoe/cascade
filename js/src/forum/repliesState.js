import app from 'flarum/forum/app';

/**
 * Per-discussion expansion state for the feed cards.
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
const states = new Map();
let v = 0;

/**
 * State for one discussion, created on first use.
 *
 * @param {string} id
 */
export function replyState(id) {
  if (!states.has(id)) {
    states.set(id, { expanded: false, loading: false, posts: [], firstPost: null });
  }

  return states.get(id);
}

/** Tell every row's SubtreeRetainer that something changed. */
export function bump() {
  v++;
  m.redraw();
}

/** The value the retainer watches. */
export function version() {
  return v;
}

/**
 * Open a discussion in place: the full opening post, then every reply.
 *
 * One request serves both. `filter[discussion]` sorted by number returns the
 * opening post first, so the same payload that carries the replies also
 * carries the full text of the post the card was showing a truncated excerpt
 * of — which is the whole point. Expanding the comments while leaving the
 * original clipped at 280 characters reads backwards.
 */
export function expand(discussion) {
  const state = replyState(discussion.id());

  state.expanded = true;

  // Fetched once per discussion per page view. Re-expanding after a collapse
  // reuses what is already in hand rather than asking again for a
  // conversation that has not moved.
  if (state.loading || state.posts.length || state.firstPost) {
    bump();
    return;
  }

  state.loading = true;
  bump();

  app.store
    .find('posts', {
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
      bump();
    })
    .catch(() => {
      state.loading = false;
      state.expanded = false;
      bump();
      app.alerts.show({ type: 'error' }, app.translator.trans('ernestdefoe-cascade.forum.row.replies_failed'));
    });
}

export function collapse(discussion) {
  replyState(discussion.id()).expanded = false;
  bump();
}
