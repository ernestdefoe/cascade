import app from 'flarum/forum/app';

/**
 * Reaction plumbing shared by the card control and the summary row.
 *
 * Cascade renders reactions as native emoji. fof/reactions itself draws them
 * with twemoji loaded from a CDN, which is a request to a third party on every
 * page and a hard dependency on that host staying up; a theme has no business
 * adding either. Native emoji render everywhere, cost nothing, and match the
 * rest of the forum's text.
 */

/**
 * Shortname to emoji, for the reaction set fof/reactions seeds by default.
 *
 * An admin who adds a custom reaction should set its `display` in the
 * extension's own settings - that is honoured first, below. This map only
 * exists so the six defaults look right out of the box.
 */
const EMOJI = {
  thumbsup: '\u{1F44D}',
  thumbsdown: '\u{1F44E}',
  laughing: '\u{1F606}',
  confused: '\u{1F615}',
  heart: '❤️',
  tada: '\u{1F389}',
  smile: '\u{1F604}',
  cry: '\u{1F622}',
  angry: '\u{1F620}',
  eyes: '\u{1F440}',
  fire: '\u{1F525}',
  rocket: '\u{1F680}',
  clap: '\u{1F44F}',
  party: '\u{1F389}',
};

/** Every enabled reaction type, in the order the admin arranged them. */
export function reactionTypes() {
  try {
    return app.store
      .all('reactions')
      .filter((r) => r.enabled() !== false)
      .sort((a, b) => Number(a.id()) - Number(b.id()));
  } catch (e) {
    return [];
  }
}

export function reactionById(id) {
  if (id === null || id === undefined) return null;

  return reactionTypes().find((r) => String(r.id()) === String(id)) || null;
}

/**
 * What to draw for a reaction: the admin's own `display` value if they set
 * one, then the emoji for a known shortname, then the shortname itself so an
 * unknown reaction is still legible rather than blank.
 */
export function reactionGlyph(reaction) {
  if (!reaction) return '';

  const display = reaction.display && reaction.display();

  if (display) return display;

  const identifier = reaction.identifier ? reaction.identifier() : '';

  return EMOJI[identifier] || identifier;
}

export function reactionLabel(reaction) {
  if (!reaction) return '';

  const identifier = reaction.identifier ? reaction.identifier() : '';
  const key = `ernestdefoe-cascade.forum.reactions.${identifier}`;
  const translated = app.translator.trans(key);

  // Flarum returns the key itself when there is no string for it, which would
  // put "ernestdefoe-cascade.forum..." on screen. Fall back to the shortname.
  if (typeof translated === 'string' && translated.indexOf(key) === 0) {
    return identifier;
  }

  return translated || identifier;
}

/**
 * Apply or clear the actor's reaction on a post.
 *
 * fof/reactions exposes this as a writable `reaction` attribute on the post
 * resource: a reaction id sets it, null clears it. Cascade does not touch the
 * reaction tables itself - every permission check, notification and
 * gamification hook lives behind that endpoint.
 *
 * @param {string|number} postId
 * @param {string|number|null} reactionId
 */
export function sendReaction(postId, reactionId) {
  return app.request({
    method: 'PATCH',
    url: `${app.forum.attribute('apiUrl')}/posts/${postId}`,
    body: {
      data: {
        type: 'posts',
        id: String(postId),
        attributes: { reaction: reactionId === null ? null : String(reactionId) },
      },
    },
  });
}
