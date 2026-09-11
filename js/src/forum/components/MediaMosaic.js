import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';

import { openModal } from '../repliesState';

/**
 * The image mosaic on a feed card.
 *
 * Layout follows the count, the way every social feed does it, because the
 * shape is what tells you at a glance how many pictures there are:
 *
 *   1  one full-width image, at its own aspect ratio
 *   2  two side by side
 *   3  one tall on the left, two stacked on the right
 *   4  a 2x2 grid
 *   5+ two on top, three below, with "+N" on the last tile
 *
 * The tiles are square-ish crops rather than natural aspect for every count
 * except one, because a mosaic of mixed aspect ratios does not tile - that is
 * the whole reason a single image is the special case.
 */
export default class MediaMosaic extends Component {
  view(vnode) {
    const discussion = vnode.attrs.discussion;
    const images = discussion.cascadeImages() || [];

    if (!images.length) return null;

    // Inside the modal the mosaic is just the post's pictures; clicking it to
    // open the modal you are already in would do nothing useful.
    const interactive = vnode.attrs.interactive !== false;
    const total = discussion.cascadeImageCount() || images.length;
    const shown = images.slice(0, 5);
    const overflow = Math.max(0, total - shown.length);

    return (
      <div
        className={`Cascade-media Cascade-media--${shown.length}`}
        onclick={interactive ? () => openModal(discussion) : undefined}
        role={interactive ? 'button' : undefined}
        tabindex={interactive ? '0' : undefined}
        aria-label={interactive ? app.translator.trans('ernestdefoe-cascade.forum.row.open_post') : undefined}
        onkeydown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openModal(discussion);
                }
              }
            : undefined
        }
      >
        {shown.map((src, i) => (
          <div className="Cascade-media-tile" key={src + i}>
            {/* Decorative: the title and excerpt above already describe the
                post, and alt text repeating them would be read twice.
                loading=lazy matters here - a page of twenty cards is otherwise
                a hundred full-size images at once. */}
            <img src={src} alt="" loading="lazy" decoding="async" />

            {overflow > 0 && i === shown.length - 1 && (
              <span className="Cascade-media-overflow" aria-hidden="true">
                +{overflow}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
}
