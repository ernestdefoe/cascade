<?php

/*
 * Cascade - a social-feed theme for Flarum 2.
 *
 * Verified against flarum/core v2.0.0-rc.8.
 */

use ErnestDefoe\Cascade\Api\Controller\TrendingController;
use ErnestDefoe\Cascade\Api\DiscussionResourceFields;
use ErnestDefoe\Cascade\Api\ReactionFields;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Extend;
use Flarum\Frontend\Document;
use Flarum\Settings\SettingsRepositoryInterface;

return [
    // -- Frontend ------------------------------------------------------------
    (new Extend\Frontend('forum'))
        ->js(__DIR__.'/js/dist/forum.js')
        // Cascade lazy-loads the conversation modal, which webpack emits as a
        // separate chunk under js/dist/forum/. Without this the chunk is never
        // served, the dynamic import hangs unresolved, and the modal shows a
        // spinner forever with nothing in the console to explain it.
        ->jsDirectory(__DIR__.'/js/dist/forum')
        ->css(__DIR__.'/less/forum.less')
        // Stamp the active preset onto <html>, the same way core stamps
        // `data-theme` and `data-colored-header`. Doing it server-side matters
        // for two reasons: the attribute is present in the very first byte of
        // HTML, so there is no flash of the other preset before JS runs; and a
        // frontend initializer CANNOT read this setting anyway, because
        // Application::boot() runs every initializer BEFORE it assigns
        // `app.forum` - so `app.forum.attribute()` at that point is a
        // TypeError that takes the whole forum down.
        ->content(function (Document $document) {
            $preset = resolve(SettingsRepositoryInterface::class)
                ->get('ernestdefoe-cascade.preset', 'wall');

            $document->extraAttributes['data-cascade-preset'] =
                in_array($preset, ['wall', 'timeline'], true) ? $preset : 'wall';
        }),

    (new Extend\Frontend('admin'))
        ->js(__DIR__.'/js/dist/admin.js')
        ->css(__DIR__.'/less/admin.less'),

    new Extend\Locales(__DIR__.'/locale'),

    // -- The feed row --------------------------------------------------------
    //
    // This is the only change Cascade makes to the discussion list payload, and
    // it is deliberately narrow. The obvious implementation - adding `firstPost`
    // to the index endpoint's defaultInclude - is the one thing NOT to do: core
    // removed it on purpose (flarum/framework#4788) because serialising a whole
    // post per discussion drags in content rendering, per-post permission
    // attributes and the liker list, none of which a list row reads.
    //
    // Instead we eager-load the relation *without serialising it*, read the
    // stored formatter XML directly, and ship two short strings plus a count.
    // The XML is already in the database and `parsed_content` returns it
    // verbatim, so nothing is parsed, unparsed or rendered. Cost: one extra
    // query per page of discussions, and a few hundred bytes per row.
    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionResourceFields::class)
        ->endpoint(Endpoint\Index::class, function (Endpoint\Index $endpoint): Endpoint\Index {
            // The callback is deliberately untyped: core hands it either an
            // Eloquent\Builder or a Relation depending on how the load resolves,
            // and the two share no common base worth naming.
            return $endpoint->eagerLoadWhere('lastPost', function ($query) {
                // One extra query for the whole page, which buys the reply
                // preview under every row. Same column discipline as firstPost.
                return $query->select(['id', 'discussion_id', 'type', 'content']);
            })->eagerLoadWhere('firstPost', function ($query) {
                // `firstPost` is a belongsTo on `discussions.first_post_id`, so
                // `posts.id` is the owner key and must stay selected or Eloquent
                // cannot match the loaded models back. `type` keeps single-table
                // inheritance working - without it every row hydrates as the
                // base Post and the CommentPost check never passes.
                return $query->select(['id', 'discussion_id', 'type', 'content']);
            });
        }),

    // Reactions are additive and optional: with fof/reactions disabled these
    // fields never exist, the frontend sees undefined, and the engagement bar
    // renders Reply and Share only. Cascade implements no reactions of its own
    // - it decorates whatever the forum already has.
    (new Extend\Conditional())
        ->whenExtensionEnabled('fof-reactions', fn () => [
            (new Extend\ApiResource(DiscussionResource::class))
                ->fields(ReactionFields::class),
        ]),

    // -- Right rail ----------------------------------------------------------
    (new Extend\Routes('api'))
        ->get('/cascade/trending', 'cascade.trending', TrendingController::class),

    // -- Settings ------------------------------------------------------------
    //
    // Storage-key prefix:   ernestdefoe-cascade.*
    // Frontend payload key: cascade.*  (read via app.forum.attribute('cascade.x'))
    (new Extend\Settings())
        ->serializeToForum('cascade.preset',          'ernestdefoe-cascade.preset',          'strval',  'wall')
        ->serializeToForum('cascade.feed_density',    'ernestdefoe-cascade.feed_density',    'strval',  'excerpt_media')
        ->serializeToForum('cascade.excerpt_length',  'ernestdefoe-cascade.excerpt_length',  'intval',  280)
        ->serializeToForum('cascade.rail_tag_count',  'ernestdefoe-cascade.rail_tag_count',  'intval',  6)
        ->serializeToForum('cascade.widget_trending', 'ernestdefoe-cascade.widget_trending', 'boolval', true)
        ->serializeToForum('cascade.widget_presence', 'ernestdefoe-cascade.widget_presence', 'boolval', true)
        ->serializeToForum('cascade.widget_follow',   'ernestdefoe-cascade.widget_follow',   'boolval', true)
        ->serializeToForum('cascade.engagement_bar',  'ernestdefoe-cascade.engagement_bar',  'strval',  'auto')
        ->serializeToForum('cascade.mobile_tabbar',   'ernestdefoe-cascade.mobile_tabbar',   'strval',  'extension')

        ->default('ernestdefoe-cascade.preset',          'wall')
        ->default('ernestdefoe-cascade.feed_density',    'excerpt_media')
        ->default('ernestdefoe-cascade.excerpt_length',  '280')
        ->default('ernestdefoe-cascade.rail_tag_count',  '6')
        ->default('ernestdefoe-cascade.widget_trending', '1')
        ->default('ernestdefoe-cascade.widget_presence', '1')
        ->default('ernestdefoe-cascade.widget_follow',   '1')
        ->default('ernestdefoe-cascade.engagement_bar',  'auto')
        ->default('ernestdefoe-cascade.mobile_tabbar',   'extension'),

    // Cascade deliberately adds no accent setting of its own - the forum's
    // primary colour in Appearance is the single source of truth, because core
    // computes button contrast colours from it at compile time (the YIQ branch
    // in less/common/root.less). See the note at the top of lib/tokens.less.
    //
    // Nothing Cascade contributes is compiled into the stylesheet either, so no
    // setting here needs to bust the asset cache: the preset is a runtime
    // attribute on <html>, and both token blocks are always in the CSS.
];
