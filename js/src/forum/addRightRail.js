import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import ItemList from 'flarum/common/utils/ItemList';
import IndexPage from 'flarum/forum/components/IndexPage';

import TrendingWidget from './components/TrendingWidget';
import { setting } from './settings';

/**
 * Add the right rail as a third column of core's page container.
 *
 * PageStructure already renders `.Page-container` as a flex row of sidebar +
 * content, so a third child needs no layout surgery — only a width, which
 * shell/layout.less supplies.
 *
 * The rail renders only when it has at least one widget with real data. An
 * empty column would be 348px of nothing, and the feed centres perfectly well
 * without it.
 */
export default function addRightRail() {
  extend('flarum/forum/components/PageStructure', 'containerItems', function (items) {
    if (!app.current || !app.current.matches(IndexPage)) return;

    const widgets = widgetItems().toArray();

    if (!widgets.length) return;

    // Priority below 'content' (10) so it lands after the feed column.
    items.add('cascadeRail', <aside className="Cascade-rail">{widgets}</aside>, 5);
  });
}

/**
 * The rail's widgets, as an ItemList so another extension can contribute one.
 */
export function widgetItems() {
  const items = new ItemList();

  if (setting('widget_trending')) {
    items.add('trending', <TrendingWidget />, 100);
  }

  return items;
}
