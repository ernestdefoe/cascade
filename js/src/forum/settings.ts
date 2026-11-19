import app from 'flarum/forum/app';

/**
 * The Cascade settings extend.php serializes to the forum, by type.
 *
 * Every one of them is always in the payload: serializeToForum reads through
 * the defaults-aware settings repository, so a forum that has never opened
 * Cascade's admin page still gets the defaults declared in extend.php.
 */
interface CascadeSettings {
  preset: string;
  feed_density: string;
  excerpt_length: number;
  widget_trending: boolean;
  engagement_bar: string;
  allow_user_preset: boolean;
  widget_hashtags: boolean;
  hashtag_count: number;
}

/**
 * Read one Cascade setting out of the forum payload.
 *
 * @param name Key without the `cascade.` prefix.
 */
export function setting<K extends keyof CascadeSettings>(name: K): CascadeSettings[K] {
  return app.forum.attribute<CascadeSettings[K]>(`cascade.${name}`);
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
export function hasExtension(id: string): boolean {
  return id in flarum.extensions;
}
