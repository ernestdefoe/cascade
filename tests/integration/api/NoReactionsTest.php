<?php

namespace ErnestDefoe\Cascade\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\Test;

class NoReactionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-cascade');

        $this->prepareDatabase([
            Discussion::class => [
                ['id' => 1, 'title' => 'A', 'created_at' => Carbon::now(), 'user_id' => 1, 'first_post_id' => 1, 'last_post_id' => 1, 'comment_count' => 1, 'last_posted_at' => Carbon::now()],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'number' => 1, 'created_at' => Carbon::now(), 'user_id' => 1, 'type' => 'comment', 'content' => '<t><p>Hello</p></t>'],
            ],
        ]);
    }

    #[Test]
    public function without_fof_reactions_there_are_no_reaction_fields()
    {
        $response = $this->send($this->request('GET', '/api/discussions'));

        $this->assertSame(200, $response->getStatusCode());
        $attributes = json_decode((string) $response->getBody(), true)['data'][0]['attributes'];

        $this->assertArrayHasKey('cascadeExcerpt', $attributes);
        $this->assertArrayNotHasKey('cascadeReactionCounts', $attributes);
        $this->assertArrayNotHasKey('cascadeFirstPostId', $attributes);
    }
}
