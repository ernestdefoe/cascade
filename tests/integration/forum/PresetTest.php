<?php

namespace ErnestDefoe\Cascade\Tests\integration\forum;

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

class PresetTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-cascade');
    }

    private function member(string $preset): void
    {
        $this->prepareDatabase([
            User::class => [$this->normalUser() + ['preferences' => json_encode(['cascadePreset' => $preset])]],
        ]);
    }

    /** The preset stamped on <html> for the given actor (a guest by default). */
    private function stamp(?int $actor = null): ?string
    {
        $response = $this->send($this->request('GET', '/', $actor ? ['authenticatedAs' => $actor] : []));

        $this->assertSame(200, $response->getStatusCode());

        return preg_match('/<html[^>]*\sdata-cascade-preset="([^"]*)"/', (string) $response->getBody(), $m) ? $m[1] : null;
    }

    #[Test]
    public function the_forums_preset_is_stamped_on_the_page()
    {
        $this->setting('ernestdefoe-cascade.preset', 'timeline');

        $this->assertSame('timeline', $this->stamp());
    }

    #[Test]
    public function a_preset_with_no_stylesheet_falls_back_to_wall()
    {
        $this->setting('ernestdefoe-cascade.preset', 'neon');

        $this->assertSame('wall', $this->stamp());
    }

    #[Test]
    public function a_members_own_choice_wins()
    {
        $this->setting('ernestdefoe-cascade.preset', 'timeline');
        $this->member('stream');

        $this->assertSame('stream', $this->stamp(2));
        $this->assertSame('timeline', $this->stamp(), 'A guest still gets the forum\'s');
    }

    #[Test]
    public function an_empty_choice_follows_the_forum()
    {
        $this->setting('ernestdefoe-cascade.preset', 'timeline');
        $this->member('');

        $this->assertSame('timeline', $this->stamp(2));
    }

    #[Test]
    public function a_members_choice_is_ignored_when_the_forum_does_not_allow_one()
    {
        $this->setting('ernestdefoe-cascade.preset', 'timeline');
        $this->setting('ernestdefoe-cascade.allow_user_preset', '0');
        $this->member('stream');

        $this->assertSame('timeline', $this->stamp(2));
    }
}
