<?php

namespace ErnestDefoe\Cascade\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

class ReactionFieldsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('fof-reactions', 'ernestdefoe-cascade');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'another', 'email' => 'another@machine.local', 'password' => 'too-obscure', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Reacted to', 'created_at' => Carbon::now(), 'user_id' => 2, 'first_post_id' => 1, 'last_post_id' => 1, 'comment_count' => 1, 'last_posted_at' => Carbon::now()],
                ['id' => 2, 'title' => 'Quiet', 'created_at' => Carbon::now()->subHour(), 'user_id' => 2, 'first_post_id' => 2, 'last_post_id' => 2, 'comment_count' => 1, 'last_posted_at' => Carbon::now()->subHour()],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'number' => 1, 'created_at' => Carbon::now(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Hello</p></t>'],
                ['id' => 2, 'discussion_id' => 2, 'number' => 1, 'created_at' => Carbon::now()->subHour(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Quiet</p></t>'],
            ],
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    private function index(?int $actor = null): array
    {
        $response = $this->send($this->request('GET', '/api/discussions', $actor ? ['authenticatedAs' => $actor] : []));

        $this->assertSame(200, $response->getStatusCode());

        $rows = [];
        foreach (json_decode((string) $response->getBody(), true)['data'] as $row) {
            $rows[(int) $row['id']] = $row['attributes'];
        }

        return $rows;
    }

    private function react(int $user, int $post, string $identifier): void
    {
        $reaction = $this->database()->table('reactions')->where('identifier', $identifier)->value('id');

        $this->database()->table('post_reactions')->insert(['user_id' => $user, 'post_id' => $post, 'reaction_id' => $reaction]);
    }

    #[Test]
    public function a_row_carries_its_opening_posts_reactions()
    {
        $this->app();
        $this->react(2, 1, 'thumbsup');
        $this->react(3, 1, 'thumbsup');
        $this->react(3, 1, 'heart');

        $thumbsup = $this->database()->table('reactions')->where('identifier', 'thumbsup')->value('id');
        $heart = $this->database()->table('reactions')->where('identifier', 'heart')->value('id');

        $rows = $this->index(2);

        $this->assertSame(1, $rows[1]['cascadeFirstPostId']);
        $this->assertEquals([$thumbsup => 2, $heart => 1], $rows[1]['cascadeReactionCounts'], 'Zero counts are dropped');
        $this->assertEquals($thumbsup, $rows[1]['cascadeUserReaction'], 'The actor\'s own reaction');
        $this->assertNull($rows[2]['cascadeUserReaction']);
    }

    #[Test]
    public function a_post_nobody_reacted_to_sends_an_empty_map()
    {
        $rows = $this->index();

        $this->assertSame([], $rows[2]['cascadeReactionCounts'], 'Nothing, rather than a zero for every reaction type');
        $this->assertNull($rows[2]['cascadeUserReaction'], 'A guest has no reaction');
    }

    #[Test]
    public function a_single_discussion_omits_the_reaction_fields()
    {
        $response = $this->send($this->request('GET', '/api/discussions/1'));
        $attributes = json_decode((string) $response->getBody(), true)['data']['attributes'];

        foreach (['cascadeFirstPostId', 'cascadeReactionCounts', 'cascadeUserReaction'] as $field) {
            $this->assertArrayNotHasKey($field, $attributes);
        }
    }
}
