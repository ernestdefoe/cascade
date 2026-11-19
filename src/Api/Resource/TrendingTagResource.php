<?php

/*
 * Cascade — a social-feed theme for Flarum 2.
 */

namespace ErnestDefoe\Cascade\Api\Resource;

use Carbon\Carbon;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractResource;
use Flarum\Api\Resource\Contracts\Listable;
use Flarum\Api\Schema;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Tags\Tag;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Tobyz\JsonApiServer\Context;

/**
 * Tags ranked by discussions actually started in the last seven days.
 *
 * The obvious implementation — ordering by `tags.discussion_count` — is wrong.
 * That column is an incremental counter maintained by event listeners; it
 * drifts whenever a discussion is deleted, merged, moved or restored outside
 * those listeners, and nothing ever reconciles it. So this recomputes.
 *
 * Entries are computed rather than stored, so this is not a database
 * resource. Registered only when flarum/tags is enabled (see extend.php).
 *
 * @extends AbstractResource<object>
 * @implements Listable<object, Context>
 */
class TrendingTagResource extends AbstractResource implements Listable
{
    public const CACHE_KEY = 'ernestdefoe-cascade.trending';
    public const CACHE_TTL = 3600;

    /**
     * Windows to try, in order, until one of them has something to show.
     *
     * A seven-day window is right for a busy forum and wrong for a quiet one,
     * whose widget would sit empty and read as broken. Widening keeps the rail
     * populated without claiming a stale tag is trending this week: every entry
     * carries the window that produced it, and the frontend labels it.
     */
    public const WINDOWS = [7, 30, 365, null];
    public const LIMIT = 5;

    public function __construct(
        protected Cache $cache,
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function type(): string
    {
        return 'cascade-trending-tags';
    }

    public function endpoints(): array
    {
        return [
            Endpoint\Index::make(),
        ];
    }

    public function fields(): array
    {
        return [
            Schema\Str::make('name'),
            Schema\Str::make('slug'),
            Schema\Integer::make('count'),
            Schema\Integer::make('days')->nullable(),
        ];
    }

    public function getId(object $model, Context $context): string
    {
        return (string) $model->id;
    }

    public function query(Context $context): object
    {
        return (object) [];
    }

    public function results(object $query, Context $context): iterable
    {
        if (! $this->settings->get('ernestdefoe-cascade.widget_trending')) {
            return [];
        }

        $actor = $context->getActor();

        // Cached per actor (guests share one entry), because discussion
        // visibility is per actor: a member also sees their own unapproved or
        // hidden discussions, and that must not reach anybody else's counts.
        $key = self::CACHE_KEY.'.'.($actor->exists ? 'u'.$actor->id : 'guest');

        return $this->cache->remember($key, self::CACHE_TTL, fn () => $this->compute($actor));
    }

    public function filters(): array
    {
        return [];
    }

    public function sorts(): array
    {
        // The order is the whole point of a ranking, so it is not the client's
        // to change.
        return [];
    }

    /**
     * @return list<object{id: int, name: string, slug: string, count: int, days: int|null}>
     */
    protected function compute(User $actor): array
    {
        foreach (self::WINDOWS as $days) {
            $rows = $this->ranked($actor, $days);

            if ($rows !== []) {
                return $rows;
            }
        }

        return [];
    }

    /**
     * One query: the tags this actor may see, each with a correlated count of
     * the discussions in it this actor may see, started within the window.
     *
     * @param  int|null  $days  null means "no lower bound"
     * @return list<object{id: int, name: string, slug: string, count: int, days: int|null}>
     */
    protected function ranked(User $actor, ?int $days): array
    {
        $tags = Tag::query()
            ->whereVisibleTo($actor)
            ->withCount(['discussions as trending_count' => function ($query) use ($actor, $days) {
                $query->whereVisibleTo($actor);

                if ($days !== null) {
                    $query->where('discussions.created_at', '>=', Carbon::now()->subDays($days));
                }
            }])
            ->orderByDesc('trending_count')
            ->orderBy('id')
            ->limit(self::LIMIT)
            ->get(['id', 'name', 'slug']);

        return $tags
            ->filter(fn (Tag $tag) => (int) $tag->getAttribute('trending_count') > 0)
            ->map(fn (Tag $tag) => (object) [
                'id' => (int) $tag->id,
                'name' => (string) $tag->name,
                'slug' => (string) $tag->slug,
                'count' => (int) $tag->getAttribute('trending_count'),
                'days' => $days,
            ])
            ->values()
            ->all();
    }
}
