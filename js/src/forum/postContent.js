/**
 * Post HTML, made safe to render outside a real post component.
 *
 * fof/upload's image previews are not images in `contentHtml`. Its s9e template
 * renders the tag to a literal `[upl-image-preview uuid=... url=...]` marker
 * and its own frontend swaps that for an <img> when the post stream mounts the
 * post. Anything rendering post HTML elsewhere - a modal, a card - gets the raw
 * marker on screen instead, a wall of UUIDs in the middle of a sentence.
 *
 * Cascade renders those images itself, from `cascadeImages`, so the markers are
 * simply removed here. Everything else in the string is Flarum's own rendered,
 * sanitised output and is left exactly as it is.
 */
const UPLOAD_MARKER = /\[upl-(?:image-preview|file)[^\]]*\]/g;

export default function postContent(html) {
  if (!html) return '';

  return html.replace(UPLOAD_MARKER, '');
}

/**
 * The same HTML, flattened to plain text.
 *
 * Used by the card's "See more", which grows the text without touching the
 * mosaic below it. Going through postContent() first is the point: otherwise
 * the expanded text opens with `[upl-image-preview uuid=...]` and a pair of
 * URLs, which is what the reader was never meant to see.
 */
export function postPlainText(html) {
  const cleaned = postContent(html);

  if (!cleaned) return '';

  // DOMParser rather than assigning innerHTML to a detached div: the document
  // it builds is inert, so nothing in the string can load a resource or fire an
  // event handler on its way to being read as text. This HTML is Flarum's own
  // sanitised output, but "parse it without running it" is free here.
  const doc = new DOMParser().parseFromString(cleaned, 'text/html');

  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}
