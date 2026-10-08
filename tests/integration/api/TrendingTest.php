<?php

namespace ErnestDefoe\Cascade\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Group\Group;
use Flarum\Tags\Tag;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use PHPUnit\Framework\Attributes\Test;

class TrendingTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    /** @var list<array<string, mixed>> */
    private array $discussions = [];

    /** @var list<array<string, int>> */
    private array $pivot = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-tags', 'ernestdefoe-cascade');
    }

    /** A discussion started $daysAgo days ago in each of the given tags. */
    private function discussion(int $daysAgo, array $tags, array $extra = []): void
    {
        $id = count($this->discussions) + 1;

        $this->discussions[] = $extra + [
            'id' => $id, 'title' => "D$id", 'created_at' => Carbon::now()->subDays($daysAgo)->subHour(),
            'user_id' => 2, 'first_post_id' => null, 'comment_count' => 1,
        ];

        foreach ($tags as $tag) {
            $this->pivot[] = ['discussion_id' => $id, 'tag_id' => $tag];
        }
    }

    private function seed(): void
    {
        $tag = fn (int $id, string $name, bool $restricted = false) => ['id' => $id, 'name' => $name, 'slug' => strtolower($name), 'is_restricted' => $restricted, 'position' => $id];

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'insider', 'email' => 'insider@machine.local', 'password' => 'too-obscure', 'is_email_confirmed' => 1],
            ],
            Group::class => [['id' => 5, 'name_singular' => 'Insider', 'name_plural' => 'Insiders', 'is_hidden' => 0]],
            'group_user' => [['user_id' => 3, 'group_id' => 5]],
            'group_permission' => [['group_id' => 5, 'permission' => 'tag4.viewForum']],
            Tag::class => [$tag(1, 'General'), $tag(2, 'Help'), $tag(3, 'News'), $tag(4, 'Staff', true)],
            Discussion::class => $this->discussions,
            'discussion_tag' => $this->pivot,
        ]);
    }

    private function trending(?int $actor = null): array
    {
        $response = $this->send($this->request('GET', '/api/cascade/trending', $actor ? ['authenticatedAs' => $actor] : []));

        $this->assertSame(200, $response->getStatusCode());

        return json_decode((string) $response->getBody(), true)['data'];
    }

    /** The widget's cache lives in the test forum's storage, which outlives a test. */
    private function boot(): void
    {
        $this->app()->getContainer()->make(Cache::class)->flush();
    }

    #[Test]
    public function tags_are_ranked_by_discussions_started_this_week()
    {
        $this->discussion(1, [2]);
        $this->discussion(2, [2]);
        $this->discussion(3, [1, 2]);
        $this->discussion(4, [1]);
        $this->discussion(20, [3]); // Outside the week.
        $this->seed();
        $this->boot();

        $this->assertSame([
            ['name' => 'Help', 'slug' => 'help', 'count' => 3, 'days' => 7],
            ['name' => 'General', 'slug' => 'general', 'count' => 2, 'days' => 7],
        ], $this->trending());
    }

    #[Test]
    public function hidden_and_private_discussions_do_not_count()
    {
        $this->discussion(1, [1]);
        $this->discussion(1, [2], ['hidden_at' => Carbon::now()]);
        $this->discussion(1, [2], ['is_private' => true]);
        $this->seed();
        $this->boot();

        $this->assertSame(['general'], array_column($this->trending(), 'slug'));
    }

    #[Test]
    public function a_quiet_forum_falls_back_to_a_wider_window_and_says_so()
    {
        $this->discussion(20, [3]);
        $this->discussion(200, [1]);
        $this->seed();
        $this->boot();

        $this->assertSame([['name' => 'News', 'slug' => 'news', 'count' => 1, 'days' => 30]], $this->trending());
    }

    #[Test]
    public function a_restricted_tag_is_shown_only_to_those_who_can_see_it()
    {
        $this->discussion(1, [4]);
        $this->discussion(1, [4]);
        $this->discussion(1, [1]);
        $this->seed();
        $this->boot();

        // The guest asks first, so a cache keyed on anything less than the
        // actor's visibility would hand the guest's answer to the insider.
        $this->assertSame(['general'], array_column($this->trending(), 'slug'), 'A guest');
        $this->assertSame(['general'], array_column($this->trending(2), 'slug'), 'A member without the permission');
        $this->assertSame(['staff', 'general'], array_column($this->trending(3), 'slug'), 'A member who can see the tag');
    }

    #[Test]
    public function at_most_five_tags_are_listed()
    {
        foreach (range(1, 6) as $n) {
            $this->discussion(1, [1, 2, 3]);
        }
        $this->seed();
        $this->prepareDatabase([Tag::class => [
            ['id' => 5, 'name' => 'Five', 'slug' => 'five', 'position' => 5],
            ['id' => 6, 'name' => 'Six', 'slug' => 'six', 'position' => 6],
            ['id' => 7, 'name' => 'Seven', 'slug' => 'seven', 'position' => 7],
        ], 'discussion_tag' => [
            ['discussion_id' => 1, 'tag_id' => 5], ['discussion_id' => 1, 'tag_id' => 6], ['discussion_id' => 1, 'tag_id' => 7],
        ]]);
        $this->boot();

        $this->assertCount(5, $this->trending());
    }

    #[Test]
    public function a_disabled_widget_returns_nothing()
    {
        $this->setting('ernestdefoe-cascade.widget_trending', '0');
        $this->discussion(1, [1]);
        $this->seed();
        $this->boot();

        $this->assertSame([], $this->trending());
    }
}
