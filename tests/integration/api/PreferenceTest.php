<?php

namespace ErnestDefoe\Cascade\Tests\integration\api;

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;

class PreferenceTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ernestdefoe-cascade');

        $this->prepareDatabase([User::class => [$this->normalUser()]]);
    }

    public static function choices(): array
    {
        return [
            'a preset' => ['timeline', 'timeline'],
            'follow the forum' => ['', ''],
            'anything else' => ['<script>', 'wall'],
        ];
    }

    #[Test]
    #[DataProvider('choices')]
    public function a_member_can_only_store_a_real_preset(string $sent, string $stored)
    {
        $response = $this->send($this->request('PATCH', '/api/users/2', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'users', 'id' => '2', 'attributes' => ['preferences' => ['cascadePreset' => $sent]]]],
        ]));

        $this->assertSame(200, $response->getStatusCode());

        $preferences = json_decode($this->database()->table('users')->where('id', 2)->value('preferences'), true);
        $this->assertSame($stored, $preferences['cascadePreset']);
    }

    #[Test]
    public function the_settings_reach_the_forum_typed()
    {
        $this->setting('ernestdefoe-cascade.excerpt_length', '120');
        $this->setting('ernestdefoe-cascade.widget_follow', '0');

        $response = $this->send($this->request('GET', '/api'));
        $attributes = json_decode((string) $response->getBody(), true)['data']['attributes'];

        $this->assertSame('wall', $attributes['cascade.preset']);
        $this->assertSame('excerpt_media', $attributes['cascade.feed_density']);
        $this->assertSame(120, $attributes['cascade.excerpt_length']);
        $this->assertSame(6, $attributes['cascade.rail_tag_count']);
        $this->assertTrue($attributes['cascade.widget_trending']);
        $this->assertFalse($attributes['cascade.widget_follow']);
        $this->assertTrue($attributes['cascade.allow_user_preset']);
        $this->assertSame(24, $attributes['cascade.hashtag_count']);
    }
}
