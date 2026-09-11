import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import ItemList from 'flarum/common/utils/ItemList';
import IndexPage from 'flarum/forum/components/IndexPage';

import TrendingWidget from './components/TrendingWidget';
import { setting } from './settings';

/**
 * fof/forum-widgets-core's side section, as it names its own item.
 */
const FOF_SIDE_ITEM = 'endWidgetSection';

/**
 * Add the right rail as a third column of core's page container.
 *
 * PageStructure already renders `.Page-container` as a flex row of sidebar +
 * content, so a third child needs no layout surgery - only a width, which
 * shell/layout.less supplies.
 *
 * The rail renders only when it has something to show. An empty 300px column
 * would push the feed off centre for nothing, and the feed centres perfectly
 * well without it.
 */
export default function addRightRail() {
  extend('flarum/forum/components/PageStructure', 'containerItems', function (items) {
    if (!app.current || !app.current.matches(IndexPage)) return;

    // fof/forum-widgets-core adds its side section to this very list, at
    // priority 1 - just below Cascade's rail. Left alone that is a FOURTH
    // column in a three-column layout: the row overflows and the feed is
    // squeezed. Adopting the item into the rail gives the forum one right-hand
    // column with both sets of widgets stacked in it, which is what an operator
    // who configured side widgets actually wants.
    //
    // This is the pattern those extensions invite - flarum/realtime documents
    // the same "take my named item and render it where you like" contract for
    // its typing indicator.
    let sideWidgets = null;

    if (items.has(FOF_SIDE_ITEM)) {
      sideWidgets = items.get(FOF_SIDE_ITEM);
      items.remove(FOF_SIDE_ITEM);
    }

    const widgets = widgetItems().toArray();

    if (!widgets.length && !sideWidgets) return;

    // Priority below 'content' (10) so it lands after the feed column.
    items.add(
      'cascadeRail',
      <aside className="Cascade-rail">
        {widgets}
        {sideWidgets}
      </aside>,
      5
    );
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
