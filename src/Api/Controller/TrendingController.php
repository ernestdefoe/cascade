<?php

/*
 * Cascade — a social-feed theme for Flarum 2.
 */

namespace ErnestDefoe\Cascade\Api\Controller;

use Flarum\Http\RequestUtil;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Tags ranked by discussions actually started in the last seven days.
 *
 * The obvious implementation — ordering by `tags.discussion_count` — is wrong.
 * That column is an incremental counter maintained by event listeners; it
 * drifts whenever a discussion is deleted, merged, moved or restored outside
 * those listeners, and nothing ever reconciles it. A widget reading it is
 * quietly wrong within a week of normal moderation. So this recomputes.
 *
 * Recomputing is a GROUP BY over a week of rows, which is cheap but not free,
 * and the widget appears on every index page load — hence the cache. The TTL
 * is deliberately long: "trending this week" does not change meaningfully in
 * an hour, and a stale-by-an-hour list is indistinguishable from a fresh one.
 */
class TrendingController implements RequestHandlerInterface
{
    public const CACHE_KEY = 'ernestdefoe-cascade.trending';
    public const CACHE_TTL = 3600;
    /**
     * Windows to try, in order, until one of them has something to show.
     *
     * A seven-day window is the right answer for a busy forum and the wrong
     * one for everybody else: a forum that gets a dozen discussions a month
     * would show an empty widget most of the time, which reads as broken
     * rather than as quiet. Falling back to a wider window keeps the rail
     * populated without ever claiming a stale tag is trending this week - the
     * frontend is told which window produced the numbers and labels it.
     */
    public const WINDOWS = [7, 30, 365, null];
    public const LIMIT = 5;

    public function __construct(
        protected ConnectionInterface $db,
        protected Cache $cache,
        protected SettingsRepositoryInterface $settings
    ) {
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->get('ernestdefoe-cascade.widget_trending', true)) {
            return new JsonResponse(['data' => []]);
        }

        if (! $this->hasTags()) {
            return new JsonResponse(['data' => []]);
        }

        $actor = RequestUtil::getActor($request);

        // The result is cached per *visibility*, not per user: two guests see
        // the same tags, and so do two members of the same groups. Keying on
        // the actor's group ids keeps restricted tags out of a guest's cache
        // entry without giving every user their own.
        $key = self::CACHE_KEY.'.'.$this->visibilityKey($actor);

        $data = $this->cache->remember($key, self::CACHE_TTL, function () use ($actor) {
            return $this->compute($actor);
        });

        return new JsonResponse(['data' => $data]);
    }

    protected function compute(User $actor): array
    {
        $visibleTagIds = $this->visibleTagIds($actor);

        if ($visibleTagIds === []) {
            return [];
        }

        foreach (self::WINDOWS as $days) {
            $rows = $this->query($actor, $visibleTagIds, $days);

            if ($rows !== []) {
                return $rows;
            }
        }

        return [];
    }

    /**
     * @param  list<int>  $visibleTagIds
     * @param  int|null   $days  null means "no lower bound"
     * @return list<array{name: string, slug: string, count: int, days: int|null}>
     */
    protected function query(User $actor, array $visibleTagIds, ?int $days): array
    {
        $query = $this->db->table('discussion_tag')
            ->join('discussions', 'discussions.id', '=', 'discussion_tag.discussion_id')
            ->join('tags', 'tags.id', '=', 'discussion_tag.tag_id')
            ->whereNull('discussions.hidden_at')
            ->where('discussions.is_private', false)
            ->whereIn('discussion_tag.tag_id', $visibleTagIds)
            ->groupBy('tags.id', 'tags.name', 'tags.slug')
            ->orderByDesc($this->db->raw('COUNT(discussion_tag.discussion_id)'))
            ->limit(self::LIMIT);

        if ($days !== null) {
            $since = (new \DateTimeImmutable())->modify('-'.$days.' days');
            $query->where('discussions.created_at', '>=', $since->format('Y-m-d H:i:s'));
        }

        $rows = $query->get([
                'tags.name as name',
                'tags.slug as slug',
                $this->db->raw('COUNT(discussion_tag.discussion_id) as discussions'),
            ]);

        return $rows->map(fn ($row) => [
            'name'  => (string) $row->name,
            'slug'  => (string) $row->slug,
            'count' => (int) $row->discussions,
            'days'  => $days,
        ])->all();
    }

    /**
     * Tag ids this actor is allowed to see.
     *
     * Restricted tags carry an `is_restricted` flag and are gated by the
     * `tag<id>.viewForum` permission. Rather than reimplementing that check,
     * this asks the actor directly — a handful of permission lookups against
     * an already-loaded permission set, not a query per tag.
     */
    protected function visibleTagIds(User $actor): array
    {
        $tags = $this->db->table('tags')->get(['id', 'is_restricted']);

        $ids = [];

        foreach ($tags as $tag) {
            if (! $tag->is_restricted || $actor->hasPermission('tag'.$tag->id.'.viewForum')) {
                $ids[] = (int) $tag->id;
            }
        }

        return $ids;
    }

    protected function visibilityKey(User $actor): string
    {
        if (! $actor->exists) {
            return 'guest';
        }

        $groups = $actor->groups()->pluck('id')->sort()->implode('-');

        return 'g'.($groups === '' ? 'none' : $groups);
    }

    protected function hasTags(): bool
    {
        return $this->db->getSchemaBuilder()->hasTable('discussion_tag');
    }
}
