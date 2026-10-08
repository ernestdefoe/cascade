<?php

namespace ErnestDefoe\Cascade\Tests\integration\api;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

class FeedFieldsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-cascade');

        $img = fn (string $src) => '<IMG src="'.$src.'"><s>![](</s>'.$src.'<e>)</e></IMG>';
        $upload = fn (string $url, string $thumb) => '<UPL-IMAGE-PREVIEW thumbnail_url="'.$thumb.'" url="'.$url.'" uuid="u">[upl-image-preview uuid=u url='.$url.']</UPL-IMAGE-PREVIEW>';

        $post = fn (int $id, int $discussion, int $number, string $content) => [
            'id' => $id, 'discussion_id' => $discussion, 'number' => $number, 'created_at' => Carbon::now()->subMinutes(100 - $id),
            'user_id' => 2, 'type' => 'comment', 'content' => $content,
        ];
        $discussion = fn (int $id, int $first, int $last, int $comments) => [
            'id' => $id, 'title' => "Discussion $id", 'created_at' => Carbon::now()->subMinutes(100 - $id), 'user_id' => 2,
            'first_post_id' => $first, 'last_post_id' => $last, 'last_posted_at' => Carbon::now()->subMinutes(100 - $id),
            'last_posted_user_id' => 2, 'comment_count' => $comments,
        ];

        $this->prepareDatabase([
            User::class => [$this->normalUser()],
            Discussion::class => [
                $discussion(1, 1, 2, 2),
                $discussion(2, 3, 3, 1),
                $discussion(3, 4, 4, 1),
                $discussion(4, 5, 5, 1),
                // Enough plain rows that a query per row clears the detector's threshold.
                $discussion(5, 6, 6, 1),
                $discussion(6, 7, 7, 1),
                $discussion(7, 8, 8, 1),
            ],
            Post::class => [
                // Prose spread over paragraphs, with an attachment marker that
                // must not reach the excerpt, and a reply.
                $post(1, 1, 1, '<r><p>First   paragraph.</p>'."\n\n".'<p>Second '.$upload('https://cdn.test/full.png', 'https://cdn.test/thumb.png').' paragraph.</p></r>'),
                $post(2, 1, 2, '<t><p>A reply,'."\n".'on two lines.</p></t>'),
                // Inline images: a badge and an unsafe scheme are dropped.
                $post(3, 2, 1, '<r><p>Look '.$img('https://img.shields.io/badge/build-passing-green').' '.$img('https://badgen.net/npm/v/flarum').' '.$img('https://ci.test/badge/status.svg').' '.$img('javascript:alert(1)').' '.$img('https://pics.test/a.png').' '.$img('/assets/b.png').' '.$img('https://pics.test/a.png').'</p></r>'),
                // More images than the mosaic shows.
                $post(4, 3, 1, '<r><p>'.implode(' ', array_map(fn ($n) => $img("https://pics.test/$n.png"), range(1, 7))).'</p></r>'),
                // A long post, for truncation.
                $post(5, 4, 1, '<t><p>'.str_repeat('words ', 200).'</p></t>'),
                $post(6, 5, 1, '<t><p>Five</p></t>'),
                $post(7, 6, 1, '<t><p>Six</p></t>'),
                $post(8, 7, 1, '<t><p>Seven</p></t>'),
            ],
        ]);
    }

    /** @return array<int, array<string, mixed>> attributes by discussion id */
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

    #[Test]
    public function a_row_carries_its_first_posts_text_without_markup_or_attachment_markers()
    {
        $rows = $this->index();

        $this->assertSame('First paragraph. Second paragraph.', $rows[1]['cascadeExcerpt']);
    }

    #[Test]
    public function attachments_are_the_mosaic_when_a_post_has_any()
    {
        $rows = $this->index();

        $this->assertSame(['https://cdn.test/thumb.png', 'https://cdn.test/full.png'], $rows[1]['cascadeImages']);
        $this->assertSame(2, $rows[1]['cascadeImageCount']);
    }

    #[Test]
    public function inline_images_leave_out_badges_unsafe_urls_and_repeats()
    {
        $rows = $this->index();

        $this->assertSame(['https://pics.test/a.png', '/assets/b.png'], $rows[2]['cascadeImages']);
        $this->assertSame(2, $rows[2]['cascadeImageCount']);
    }

    #[Test]
    public function the_mosaic_carries_at_most_five_images_but_counts_them_all()
    {
        $rows = $this->index();

        $this->assertCount(5, $rows[3]['cascadeImages']);
        $this->assertSame(7, $rows[3]['cascadeImageCount']);
    }

    #[Test]
    public function the_excerpt_is_cut_on_a_word_at_the_configured_length()
    {
        $this->setting('ernestdefoe-cascade.excerpt_length', 50);

        $excerpt = $this->index()[4]['cascadeExcerpt'];

        $this->assertSame(rtrim(str_repeat('words ', 8)).'…', $excerpt, 'Not "words wo…"');
    }

    #[Test]
    public function the_excerpt_length_cannot_exceed_the_ceiling()
    {
        $this->setting('ernestdefoe-cascade.excerpt_length', 5000);

        $excerpt = $this->index()[4]['cascadeExcerpt'];

        $this->assertLessThanOrEqual(601, mb_strlen($excerpt));
        $this->assertStringEndsWith('…', $excerpt);
    }

    #[Test]
    public function the_latest_reply_is_previewed_but_an_unanswered_opening_post_is_not()
    {
        $rows = $this->index();

        $this->assertSame('A reply, on two lines.', $rows[1]['cascadeLastReply']);
        $this->assertNull($rows[2]['cascadeLastReply'], 'The opening post is not its own reply');
    }

    #[Test]
    public function a_title_only_feed_sends_neither_excerpt_nor_images()
    {
        $this->setting('ernestdefoe-cascade.feed_density', 'title');

        $row = $this->index()[1];

        $this->assertArrayNotHasKey('cascadeExcerpt', $row);
        $this->assertArrayNotHasKey('cascadeImages', $row);
        $this->assertArrayNotHasKey('cascadeImageCount', $row);
    }

    #[Test]
    public function an_excerpt_feed_sends_no_images()
    {
        $this->setting('ernestdefoe-cascade.feed_density', 'excerpt');

        $row = $this->index()[1];

        $this->assertArrayHasKey('cascadeExcerpt', $row);
        $this->assertArrayNotHasKey('cascadeImages', $row);
        $this->assertArrayNotHasKey('cascadeImageCount', $row);
    }

    #[Test]
    public function a_single_discussion_omits_the_fields_rather_than_sending_them_empty()
    {
        $response = $this->send($this->request('GET', '/api/discussions/1'));

        $this->assertSame(200, $response->getStatusCode());
        $attributes = json_decode((string) $response->getBody(), true)['data']['attributes'];

        foreach (['cascadeExcerpt', 'cascadeImages', 'cascadeImageCount', 'cascadeLastReply'] as $field) {
            $this->assertArrayNotHasKey($field, $attributes);
        }
    }

    #[Test]
    public function the_first_and_last_posts_are_loaded_once_per_page_not_per_row()
    {
        // flarum/testing fails the request on a query repeated per row, so
        // seven rows reading their first and last posts must not query once each.
        $rows = $this->index(2);

        $this->assertCount(7, $rows);
        $this->assertSame('First paragraph. Second paragraph.', $rows[1]['cascadeExcerpt']);
    }
}
