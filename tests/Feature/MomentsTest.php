<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Moment;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MomentsTest extends TestCase
{
    use RefreshDatabase;

    private function fakeClips(): void
    {
        Http::fake([
            'www.youtube.com/oembed*' => Http::response(['title' => 'Ейс на Dust2']),
            'clips.twitch.tv/*' => Http::response('<html><head><meta property="og:title" content="Клатч 1v4"><meta property="og:image" content="https://clips-media.twitch.tv/thumb.jpg"></head></html>'),
            'medal.tv/*' => Http::response('<html><head><meta property="og:title" content="Втеча від копів"><meta name="twitter:player" content="https://medal.tv/clip/abc123?autoplay=1"><meta property="og:image" content="https://cdn.medal.tv/t.jpg"></head></html>'),
        ]);
    }

    public function test_players_share_clips_from_youtube_twitch_and_medal(): void
    {
        $this->withoutVite();
        $this->fakeClips();
        $user = User::factory()->create();
        $game = Game::query()->create(['slug' => 'cs2', 'name' => 'Counter-Strike 2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);

        $this->actingAs($user)->post(route('moments.store'), ['url' => 'https://example.com/video'])->assertStatus(422);
        $this->actingAs($user)->post(route('moments.store'), ['url' => 'https://youtu.be/dQw4w9WgXcQ?t=3', 'game' => 'cs2'])->assertRedirect('/moments');
        $this->actingAs($user)->post(route('moments.store'), ['url' => 'https://www.twitch.tv/streamer/clip/FunnyClipSlug-abc'])->assertRedirect();
        $this->actingAs($user)->post(route('moments.store'), ['url' => 'https://medal.tv/games/gta-v/clips/abc123/escape', 'title' => 'Моя назва'])->assertRedirect();
        // Той самий кліп удруге не додається.
        $this->actingAs($user)->post(route('moments.store'), ['url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'])->assertRedirect();
        $this->assertSame(3, Moment::query()->count());

        $youtube = Moment::query()->where('provider', 'youtube')->sole();
        $this->assertSame('Ейс на Dust2', $youtube->title);
        $this->assertSame($game->id, $youtube->game_id);
        $this->assertSame('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', $youtube->thumbnail);
        $this->assertSame('Моя назва', Moment::query()->where('provider', 'medal')->value('title'));

        $this->actingAs($user)->get(route('moments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('moments/index')
                ->has('moments', 3)
                ->where('moments.0.provider', 'medal')
                ->where('moments.0.player', 'https://medal.tv/clip/abc123?autoplay=1')
                ->where('moments.1.title', 'Клатч 1v4')
                ->where('moments.1.player', fn (string $url) => str_starts_with($url, 'https://clips.twitch.tv/embed?clip=FunnyClipSlug-abc&parent=')));

        $this->actingAs($user)->get(route('moments.index', ['game' => 'cs2']))->assertInertia(fn (Assert $page) => $page->has('moments', 1)->where('game.name', 'Counter-Strike 2'));
        $this->actingAs($user)->get('/games/cs2')->assertInertia(fn (Assert $page) => $page->has('moments', 1));
    }

    public function test_likes_best_of_week_friends_and_deleting(): void
    {
        $this->withoutVite();
        $this->fakeClips();
        [$author, $fan, $friend] = User::factory()->count(3)->create();
        $this->actingAs($author)->post(route('moments.store'), ['url' => 'https://youtu.be/aaaaaaaaaaa'])->assertRedirect();
        $this->actingAs($friend)->post(route('moments.store'), ['url' => 'https://youtu.be/bbbbbbbbbbb'])->assertRedirect();
        $first = Moment::query()->where('external_id', 'aaaaaaaaaaa')->sole();

        $this->actingAs($fan)->postJson(route('moments.like', $first))->assertOk()->assertJson(['liked' => true, 'likes' => 1]);
        $this->actingAs($fan)->postJson(route('moments.like', $first))->assertOk()->assertJson(['liked' => false, 'likes' => 0]);
        $this->actingAs($fan)->postJson(route('moments.like', $first))->assertOk();

        $this->actingAs($fan)->get(route('moments.index', ['tab' => 'week']))
            ->assertInertia(fn (Assert $page) => $page->where('moments.0.id', $first->id)->where('moments.0.liked', true));

        $friendships = app(FriendshipService::class);
        $friendships->request($fan, $friend);
        $friendships->accept($friend, $fan);
        $this->actingAs($fan)->get(route('moments.index', ['tab' => 'friends']))
            ->assertInertia(fn (Assert $page) => $page->has('moments', 1)->where('moments.0.user.id', $friend->id));

        $this->actingAs($fan)->delete(route('moments.destroy', $first))->assertForbidden();
        $this->actingAs($author)->delete(route('moments.destroy', $first))->assertRedirect();
        $this->assertSame(1, Moment::query()->count());
    }
}
