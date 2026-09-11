import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Link from 'flarum/common/components/Link';
import { setting } from '../settings';

/**
 * A weighted cloud of the forum's most-used hashtags.
 *
 * Reads ernestdefoe/hashtags' own `/api/hashtags` endpoint rather than counting
 * anything itself. That extension owns what a hashtag is, which posts count
 * toward one, and who is allowed to see it — reimplementing any of that here
 * would be a second answer to the same question, and the two would drift.
 *
 * The widget only renders when that extension is enabled; see widgetItems().
 */
export default class HashtagCloudWidget extends Component {
  oninit(vnode) {
    super.oninit(vnode);

    this.loading = true;
    this.tags = [];

    app
      .request({
        method: 'GET',
        url: `${app.forum.attribute('apiUrl')}/hashtags`,
        // Asked for by popularity, but sorted again below: the endpoint's sort
        // parameters are that extension's business and could be renamed, while
        // postCount is in the payload either way. Over-fetch a little and rank
        // here, so a sort name changing upstream costs ordering, not the widget.
        params: { page: { limit: 60 } },
      })
      .then((response) => {
        this.tags = rank(response?.data ?? [], count());
        this.loading = false;
        m.redraw();
      })
      .catch(() => {
        // A failed widget must not take the page with it. The rail renders
        // nothing, which is what a forum with no hashtags yet sees anyway.
        this.tags = [];
        this.loading = false;
        m.redraw();
      });
  }

  view() {
    if (!this.loading && !this.tags.length) return null;

    return (
      <section className="Cascade-widget Cascade-widget--hashtags">
        <h3 className="Cascade-widget-title">{app.translator.trans('ernestdefoe-cascade.forum.rail.hashtags_title')}</h3>

        {this.loading ? (
          <LoadingIndicator display="block" size="small" />
        ) : (
          <div className="Cascade-hashtagCloud">{this.tags.map(hashtagView)}</div>
        )}
      </section>
    );
  }
}

/** How many hashtags the admin wants in the cloud. */
function count() {
  const configured = parseInt(setting('hashtag_count'), 10);

  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 60) : 24;
}

/**
 * Rank by use and assign each hashtag a weight of 1-5.
 *
 * A cloud whose type size is driven by the raw count is unreadable on a real
 * forum: one hashtag with 400 posts and forty with 3 gives one enormous word
 * and a field of identical small ones. Weighting by RANK instead spreads the
 * sizes evenly however lopsided the counts are, which is the only reason a
 * cloud communicates anything at a glance.
 */
function rank(data, limit) {
  const tags = data
    .map((row) => ({
      name: row.attributes?.name ?? '',
      posts: row.attributes?.postCount ?? 0,
    }))
    .filter((t) => t.name)
    .sort((a, b) => b.posts - a.posts)
    .slice(0, limit);

  return tags.map((tag, index) => ({
    ...tag,
    // Bucket by position in the list, not by count.
    weight: tags.length < 2 ? 3 : 5 - Math.floor((index / tags.length) * 5),
  }));
}

function hashtagView(tag) {
  return (
    <Link
      className={`Cascade-hashtag Cascade-hashtag--w${tag.weight}`}
      href={app.route('hashtag', { name: tag.name })}
      key={tag.name}
      title={app.translator.trans('ernestdefoe-cascade.forum.rail.hashtags_count', { count: tag.posts })}
    >
      #{tag.name}
    </Link>
  );
}
