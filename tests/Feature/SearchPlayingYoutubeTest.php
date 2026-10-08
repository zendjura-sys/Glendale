<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SearchPlayingYoutubeTest extends TestCase
{
    use RefreshDatabase;

    public function test_quick_search_returns_people_and_catalog_hits(): void
    {
        $user = User::factory()->create(['username' => 'finder', 'name' => 'Finder One']);
        User::factory()->create(['username' => 'nova', 'name' => 'Nova Player', 'first_name' => 'Nova', 'last_name' => 'Player']);
        Game::query()->create([
            'slug' => 'nova-drift',
            'name' => 'Nova Drift',
            'letter' => 'N',
            'category' => 'pc',
            'is_published' => true,
            'popularity' => 10,
        ]);

        $this->actingAs($user)->getJson('/search/quick?q=nova')
            ->assertOk()
            ->assertJsonFragment(['kind' => 'user', 'title' => 'Nova Player', 'href' => '/nova'])
            ->assertJsonFragment(['kind' => 'game', 'title' => 'Nova Drift', 'href' => '/games/nova-drift']);
    }

    public function test_feed_lists_friends_who_are_playing(): void
    {
        [$viewer, $friend] = User::factory()->count(2)->create();
        $this->actingAs($viewer)->post(route('friends.store', $friend));
        $this->actingAs($friend)->post(route('friends.accept', $viewer));
        $friend->forceFill([
            'playing_kind' => 'game',
            'playing_label' => 'Nova Drift',
            'playing_url' => '/games/nova-drift',
            'playing_until' => now()->addHour(),
            'playing_source' => 'manual',
        ])->save();

        $this->withoutVite()->actingAs($viewer)->get(route('feed'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('playingNow.0.username', $friend->username)
                ->where('playingNow.0.playing.label', 'Nova Drift'));
    }

    public function test_youtube_link_in_a_post_is_stored_as_a_card(): void
    {
        Http::fake([
            'www.youtube.com/oembed*' => Http::response([
                'title' => 'Night raid',
                'thumbnail_url' => 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
                'author_name' => 'GameCon',
            ]),
        ]);
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('posts.store'), [
            'body' => 'Дивись https://youtu.be/abcdefghijk',
            'visibility' => 'public',
        ])->assertRedirect();

        $link = Post::query()->firstOrFail()->link;
        $this->assertSame('https://www.youtube.com/watch?v=abcdefghijk', $link['url']);
        $this->assertSame('Night raid', $link['title']);
        $this->assertSame('GameCon', $link['author']);
    }
}
