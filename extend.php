<?php

/*
 * Cascade - a social-feed theme for Flarum 2.
 *
 * Verified against flarum/core v2.0.0-rc.8.
 */

use ErnestDefoe\Cascade\Api\DiscussionResourceFields;
use ErnestDefoe\Cascade\Api\ReactionFields;
use ErnestDefoe\Cascade\Api\Resource\TrendingTagResource;
use ErnestDefoe\Cascade\Frontend\StampPreset;
use ErnestDefoe\Cascade\Presets;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Extend;

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
        // The active preset on <html>, server-side so there is no flash of the
        // other preset before JS runs. See the class for why it cannot be done
        // from a frontend initializer.
        ->content(StampPreset::class),

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
            /*
             * 🚨 The WHOLE row, not a column subset.
             *
             * These relations used to be narrowed to id, discussion_id, type
             * and content. That is fine while nobody serialises them — and on
             * a forum where nobody does, it is invisible. But the eager load
             * is shared: the moment ANY other extension includes `firstPost`
             * or `lastPost` on the discussion index, those posts are
             * serialised from the models Cascade narrowed, and they go to the
             * browser with `createdAt: null` and `number: null`.
             *
             * Flarum's store then holds a half-loaded Post, and core's
             * PostStream does `post.createdAt().toISOString()` with no guard —
             * so opening any discussion throws "Cannot read properties of null
             * (reading 'toISOString')" and the whole thread renders blank.
             * Reported from a forum running a trending-posts extension, and
             * impossible to reproduce without one, which is exactly what made
             * it look like somebody else's bug.
             *
             * The subset saved almost nothing anyway: `content` is by far the
             * largest column and was always selected. Everything dropped was a
             * handful of scalars on a row already being read.
             *
             * Rule of thumb: never narrow the columns of a relation other code
             * can ask for. A private query may select what it likes; a shared
             * one has to load a model that is safe to serialise.
             */
            return $endpoint->eagerLoadWhere('lastPost', fn ($query) => $query)
                ->eagerLoadWhere('firstPost', fn ($query) => $query);
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
    //
    // Trending tags need flarum/tags: without it there is nothing to rank, and
    // the resource never exists (the widget is only shown when Tags is on).
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-tags', fn () => [
            new Extend\ApiResource(TrendingTagResource::class),
        ]),

    /*
     * The member's own preset choice.
     *
     * 🚨 The transformer is what keeps this safe. A preference is written from
     * the client, so without it any member could store an arbitrary string that
     * the document stamp would then put on <html> — and an attribute no token
     * block matches leaves every colour falling back to inheritance, which is
     * an unstyled forum for that one user and nobody else.
     *
     * '' is a real, kept value here: it means "follow the forum's setting",
     * which is the picker's first option. Presets::valid() would turn it into
     * 'wall' and quietly pin the member to a preset they never chose.
     */
    (new Extend\User())
        ->registerPreference(
            'cascadePreset',
            fn ($value) => $value === '' || $value === null ? '' : Presets::valid($value),
            ''
        ),

    // -- Settings ------------------------------------------------------------
    //
    // Storage-key prefix:   ernestdefoe-cascade.*
    // Frontend payload key: cascade.*  (read via app.forum.attribute('cascade.x'))
    (new Extend\Settings())
        ->serializeToForum('cascade.preset', 'ernestdefoe-cascade.preset', 'strval')
        ->serializeToForum('cascade.feed_density', 'ernestdefoe-cascade.feed_density', 'strval')
        ->serializeToForum('cascade.excerpt_length', 'ernestdefoe-cascade.excerpt_length', 'intval')
        ->serializeToForum('cascade.widget_trending', 'ernestdefoe-cascade.widget_trending', 'boolval')
        ->serializeToForum('cascade.engagement_bar', 'ernestdefoe-cascade.engagement_bar', 'strval')
        ->serializeToForum('cascade.allow_user_preset', 'ernestdefoe-cascade.allow_user_preset', 'boolval')
        ->serializeToForum('cascade.widget_hashtags', 'ernestdefoe-cascade.widget_hashtags', 'boolval')
        ->serializeToForum('cascade.hashtag_count', 'ernestdefoe-cascade.hashtag_count', 'intval')

        ->default('ernestdefoe-cascade.preset', 'wall')
        ->default('ernestdefoe-cascade.feed_density', 'excerpt_media')
        ->default('ernestdefoe-cascade.excerpt_length', '280')
        ->default('ernestdefoe-cascade.widget_trending', '1')
        ->default('ernestdefoe-cascade.engagement_bar', 'auto')
        ->default('ernestdefoe-cascade.allow_user_preset', '1')
        ->default('ernestdefoe-cascade.widget_hashtags', '1')
        ->default('ernestdefoe-cascade.hashtag_count', '24'),

    // Cascade deliberately adds no accent setting of its own - the forum's
    // primary colour in Appearance is the single source of truth, because core
    // computes button contrast colours from it at compile time (the YIQ branch
    // in less/common/root.less). See the note at the top of lib/tokens.less.
    //
    // Nothing Cascade contributes is compiled into the stylesheet either, so no
    // setting here needs to bust the asset cache: the preset is a runtime
    // attribute on <html>, and both token blocks are always in the CSS.
];
