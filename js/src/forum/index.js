import app from 'flarum/forum/app';
import Model from 'flarum/common/Model';
import Discussion from 'flarum/common/models/Discussion';

import decorateRow from './decorateRow';
import addComposerTrigger from './addComposerTrigger';
import addRightRail from './addRightRail';

// NOTE: the Admin extender is exported from js/src/admin/index.js and NOWHERE
// else. It calls app.extensionData, which exists only on the admin frontend —
// re-exporting it here runs it during forum boot and takes the entire forum
// down with "Cannot read properties of undefined (reading 'for')".

// The three fields extend.php contributes to the discussion list payload.
// Declaring them on the model is what makes `discussion.cascadeExcerpt()`
// work — without this they sit in the JSON and stay invisible to the frontend.
Discussion.prototype.cascadeExcerpt = Model.attribute('cascadeExcerpt');
Discussion.prototype.cascadeImages = Model.attribute('cascadeImages');
Discussion.prototype.cascadeImageCount = Model.attribute('cascadeImageCount');
Discussion.prototype.cascadeLastReply = Model.attribute('cascadeLastReply');

// Present only when fof/reactions is enabled - see the Conditional block in
// extend.php. The engagement bar checks for undefined and omits the reaction
// control rather than rendering a button with nothing behind it.
Discussion.prototype.cascadeFirstPostId = Model.attribute('cascadeFirstPostId');
Discussion.prototype.cascadeReactionCounts = Model.attribute('cascadeReactionCounts');
Discussion.prototype.cascadeUserReaction = Model.attribute('cascadeUserReaction');

app.initializers.add('ernestdefoe-cascade', () => {
  decorateRow();
  addComposerTrigger();
  addRightRail();
});
