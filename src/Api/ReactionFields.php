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
 * This costs no per-row queries. fof/reactions keeps a request-scoped
 * ReactionCountResolver. On 2.0.0 betas it primes it with every discussion's
 * `first_post_id` before the index endpoint serialises; from 2.0.1 fields
 * register their post and return a closure, and the first one resolved loads
 * every registered post in one batch. Cascade uses whichever the installed
 * version offers.
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
                ->get(function (Discussion $discussion, Context $context) {
                    if (! $discussion->first_post_id) {
                        return (object) [];
                    }

                    $postId = (int) $discussion->first_post_id;

                    // Cast so an empty map serialises as {} rather than [] -
                    // the frontend indexes it by reaction id either way, but a
                    // bare array would arrive as a JS array and read wrong.
                    $shape = fn (array $counts): object => (object) array_filter($counts, fn ($count) => $count > 0);

                    // fof/reactions >= 2.0.1: register the post and hand the
                    // serializer a closure; the first one resolved loads every
                    // registered post in one batch (it no longer primes the
                    // resolver from the discussion list).
                    if (method_exists($this->resolver, 'deferCounts')) {
                        $deferred = $this->resolver->deferCounts($postId, $context->request);

                        return fn () => $shape($deferred());
                    }

                    // 2.0.0 betas: already primed for every row's first post.
                    return $shape($this->resolver->countsFor($postId));
                }),

            Schema\Number::make('cascadeUserReaction')
                ->visible(fn (Discussion $discussion, Context $context) => $this->canCompute($discussion, $context))
                ->get(function (Discussion $discussion, Context $context) {
                    if (! $discussion->first_post_id || ! $context->getActor()->exists) {
                        return null;
                    }

                    // Deferred on >= 2.0.1 for the same one-batch load; the
                    // betas take the same arguments and are already primed.
                    $method = method_exists($this->resolver, 'deferUserReaction') ? 'deferUserReaction' : 'userReactionFor';

                    return $this->resolver->{$method}(
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
