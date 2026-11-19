import app from 'flarum/forum/app';

import decorateRow from './decorateRow';
import addComposerTrigger from './addComposerTrigger';
import addRightRail from './addRightRail';
import addPresetPicker from './addPresetPicker';
import dontTranslateAvatars from './dontTranslateAvatars';

export { default as extend } from './extend';

// NOTE: the Admin extender is exported from js/src/admin/index.ts and NOWHERE
// else. It calls app.extensionData, which exists only on the admin frontend —
// re-exporting it here runs it during forum boot and takes the entire forum
// down with "Cannot read properties of undefined (reading 'for')".

// Priority -100 so this initializer runs LAST.
//
// `extend()` wraps: each registration wraps the previous one, and a wrapper
// calls the original before its own callback - so the callback registered LAST
// runs LAST. Cascade needs that for `PageStructure.containerItems`, where it
// adopts fof/forum-widgets-core's side section out of the list. If Cascade
// registered first, FoF would add its item after Cascade had already looked for
// it, and the forum would get a fourth column instead.
//
// Core sorts initializers by priority, descending.
app.initializers.add(
  'ernestdefoe-cascade',
  () => {
    decorateRow();
    addComposerTrigger();
    addRightRail();
    addPresetPicker();
    dontTranslateAvatars();
  },
  -100
);
