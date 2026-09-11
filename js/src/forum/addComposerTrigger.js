import { extend } from 'flarum/common/extend';

import ComposerTrigger from './components/ComposerTrigger';

/**
 * Put the composer trigger at the top of the feed.
 */
export default function addComposerTrigger() {
  extend('flarum/forum/components/IndexPage', 'contentItems', function (items) {
    // Above the discussion list (90), below the toolbar (100).
    items.add('cascadeComposer', <ComposerTrigger />, 95);
  });
}
