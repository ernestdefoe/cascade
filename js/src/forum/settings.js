import app from 'flarum/forum/app';

/**
 * The defaults extend.php declares. Repeated here so a forum that has never
 * opened Cascade's admin page — and therefore has no stored rows — still gets
 * the intended theme instead of a page full of `undefined`.
 */
const DEFAULTS = {
  preset: 'wall',
  feed_density: 'excerpt_media',
  excerpt_length: 280,
  rail_tag_count: 6,
  widget_trending: true,
  widget_presence: true,
  widget_follow: true,
  engagement_bar: 'auto',
  mobile_tabbar: 'extension',
  allow_user_preset: true,
  widget_hashtags: true,
  hashtag_count: 24,
};

/**
 * Read one Cascade setting out of the forum payload.
 *
 * @param {string} name Key without the `cascade.` prefix.
 */
export function setting(name) {
  const value = app.forum.attribute(`cascade.${name}`);

  return value === undefined || value === null ? DEFAULTS[name] : value;
}

/**
 * Which reaction extension, if any, the engagement bar should decorate.
 *
 * Cascade never ships its own reactions, so when nothing is enabled the bar
 * must not render a Like button at all — a control that looks live and does
 * nothing is worse than an absent one.
 *
 * @returns {'likes'|'reactions'|null}
 */
export function reactionProvider() {
  const mode = setting('engagement_bar');

  if (mode === 'off') return null;

  if (hasExtension('flarum-likes')) return 'likes';
  if (hasExtension('fof-reactions')) return 'reactions';

  // 'on' forces the rest of the bar to render, but there is still nothing to
  // wire a reaction control to — so the caller gets null and shows Reply and
  // Share only, rather than a dead Like button.
  return null;
}

/**
 * Whether an extension is enabled on this forum.
 *
 * `flarum.extensions` is keyed by extension id and populated by the wrapper
 * core puts around every extension bundle it serves, so membership means "this
 * extension is enabled and its JS is on the page". Core documents this exact
 * check in its own global typings.
 *
 * Caveat worth knowing: an enabled extension that ships no forum JS never
 * appears here. Every extension Cascade looks for has a bundle.
 */
export function hasExtension(id) {
  try {
    return id in flarum.extensions;
  } catch (e) {
    return false;
  }
}
