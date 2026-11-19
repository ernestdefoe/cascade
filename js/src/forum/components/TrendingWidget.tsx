import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Link from 'flarum/common/components/Link';
import type Mithril from 'mithril';
import railRequest from '../railCache';

/**
 * Tags ranked by how many discussions they actually received in the last
 * seven days.
 *
 * The count is recomputed server-side, never read from `tags.discussion_count`
 * — that column is an incremental counter that drifts and never self-heals, so
 * a widget reading it is wrong within a week of any moderation activity.
 *
 * Served as the `cascade-trending-tags` JSON:API resource, which exists only
 * while flarum/tags is enabled; see widgetItems().
 */
interface Trend {
  name: string;
  slug: string;
  count: number;
  days: number;
}

export default class TrendingWidget extends Component {
  loading = true;
  trends: Trend[] = [];

  oninit(vnode: Mithril.Vnode<ComponentAttrs, this>) {
    super.oninit(vnode);

    railRequest<{ data?: { attributes: Trend }[] } | null>(`${app.forum.attribute('apiUrl')}/cascade-trending-tags`)
      .then((response) => {
        this.trends = (response?.data ?? []).map((row) => row.attributes);
        this.loading = false;
        m.redraw();
      })
      .catch(() => {
        // A failed widget must not take the page with it. The rail simply
        // renders nothing, which is what a forum with nothing trending sees
        // anyway. app.request has already shown its own alert for the HTTP
        // error.
        this.trends = [];
        this.loading = false;
        m.redraw();
      });
  }

  view() {
    if (!this.loading && !this.trends.length) return null;

    return (
      <section className="Cascade-widget Cascade-widget--trending">
        <h3 className="Cascade-widget-title">{app.translator.trans('ernestdefoe-cascade.forum.rail.trending_title')}</h3>

        {/*
          The window belongs to the WIDGET, not to each row. TrendingTagResource
          picks one window for the whole response - it tries each in turn and
          returns the first that is not empty - so every row always carries the
          same `days`, and printing it per row said "Trending this week" three
          times under a heading that already said "Trending".

          Invisible on a forum with one trending tag, which is why it survived:
          it only looks wrong once there are two rows to compare.
        */}
        {!this.loading && this.trends.length > 0 && <div className="Cascade-widget-context">{contextLabel(this.trends[0].days)}</div>}

        {this.loading ? <LoadingIndicator display="block" size="small" /> : this.trends.map(trendView)}
      </section>
    );
  }
}

/**
 * Name the window the numbers actually came from.
 *
 * The endpoint widens its window until it finds something, so a quiet forum
 * still gets a populated widget - but it must not then claim a tag from four
 * months ago is trending this week.
 */
function contextLabel(days: number): Mithril.Children {
  if (days === 7) return app.translator.trans('ernestdefoe-cascade.forum.rail.trending_week');
  if (days === 30) return app.translator.trans('ernestdefoe-cascade.forum.rail.trending_month');

  return app.translator.trans('ernestdefoe-cascade.forum.rail.trending_all');
}

function trendView(trend: Trend): Mithril.Children {
  return (
    <Link className="Cascade-trend" href={app.route('tag', { tags: trend.slug })} key={trend.slug}>
      <div className="Cascade-trend-name">{trend.name}</div>
      <div className="Cascade-trend-count">{app.translator.trans('ernestdefoe-cascade.forum.rail.trending_count', { count: trend.count })}</div>
    </Link>
  );
}
