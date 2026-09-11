<?php

/*
 * Cascade - a social-feed theme for Flarum 2.
 */

namespace ErnestDefoe\Cascade\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use FoF\Reactions\ReactionCountResolver;

/**
 * Enough about the opening post's reactions to draw a working reaction control
 * on a feed card, and nothing more.
 *
 * This costs zero extra queries. fof/reactions already primes its
 * ReactionCountResolver with every discussion's `first_post_id` before the
 * index endpoint serialises (see its own beforeSerialization hook), precisely
 * so that per-post lookups hit a request-scoped memo instead of the database.
 * Cascade reads that same memo.
 *
 * Which is also why this does NOT include `firstPost` as a relationship:
 * serialising the post to reach its reaction fields would drag in rendered
 * content, every per-post permission attribute and the reactor list, twenty
 * times per page - exactly what core removed from this endpoint in
 * flarum/framework#4788. Three scalars do the job.
 *
 * Registered only when fof/reactions is enabled. Cascade ships no reactions of
 * its own; without the extension the engagement bar is Reply and Share, rather
 * than a reaction button with nothing behind it.
 */
class ReactionFields
{
    public function __construct(
        protected ReactionCountResolver $resolver
    ) {
    }

    public function __invoke(): array
    {
        return [
            // The post a reaction actually acts on. Just the `first_post_id`
            // column already present on the discussions row.
            Schema\Integer::make('cascadeFirstPostId')
                ->visible(fn (Discussion $discussion, Context $context) => $this->canCompute($discussion, $context))
                ->get(fn (Discussion $discussion) => $discussion->first_post_id),

            // [reactionId => count], zero-count types dropped so a page of
            // twenty rows does not carry a hundred-odd empty entries.
            Schema\Arr::make('cascadeReactionCounts')
                ->visible(fn (Discussion $discussion, Context $context) => $this->canCompute($discussion, $context))
                ->get(function (Discussion $discussion): object {
                    if (! $discussion->first_post_id) {
                        return (object) [];
                    }

                    $counts = array_filter(
                        $this->resolver->countsFor((int) $discussion->first_post_id),
                        fn ($count) => $count > 0
                    );

                    // Cast so an empty map serialises as {} rather than [] -
                    // the frontend indexes it by reaction id either way, but a
                    // bare array would arrive as a JS array and read wrong.
                    return (object) $counts;
                }),

            Schema\Number::make('cascadeUserReaction')
                ->visible(fn (Discussion $discussion, Context $context) => $this->canCompute($discussion, $context))
                ->get(function (Discussion $discussion, Context $context) {
                    if (! $discussion->first_post_id || ! $context->getActor()->exists) {
                        return null;
                    }

                    return $this->resolver->userReactionFor(
                        (int) $discussion->first_post_id,
                        $context->getActor(),
                        $context->request
                    );
                }),
        ];
    }

    /**
     * Only on the discussions index, where fof/reactions has primed its
     * resolver for every row's first post.
     *
     * Elsewhere - a discussion included from the posts endpoint, say - the
     * resolver would fall back to a query per post, and the resulting empty
     * values would OVERWRITE good ones already in the frontend store, because
     * Model.pushData merges with Object.assign. Absent keys are left alone;
     * present-but-empty ones are not. See the longer note in
     * DiscussionResourceFields::canCompute().
     */
    protected function canCompute(Discussion $discussion, Context $context): bool
    {
        return $context->listing() && $discussion->relationLoaded('firstPost');
    }
}
