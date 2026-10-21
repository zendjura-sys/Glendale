<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Post;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Services\MusicService;
use App\Services\Presence\PlayingStatus;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/** «Підсумки року»: сезон грудень — січень, що потрапляє в підсумки, запис історії музики й ігор. */
class WrappedTest extends TestCase
{
    use RefreshDatabase;

    public function test_outside_season_only_admin_sees_preview(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 21));
        $user = User::factory()->create();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($user)->get('/wrapped')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('wrapped')->where('wrapped', null));
        $this->actingAs($admin)->get('/wrapped')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('wrapped.year', 2026)->where('preview', true));
    }

    public function test_december_shows_the_year_and_january_the_previous_one(): void
    {
        $user = User::factory()->create();

        $this->travelTo(now()->setDate(2026, 12, 3));
        $this->actingAs($user)->get('/wrapped')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('wrapped.year', 2026)->where('preview', false));

        $this->travelTo(now()->setDate(2027, 1, 20));
        $this->actingAs($user)->get('/wrapped')
            ->assertInertia(fn (AssertableInertia $page) => $page->where('wrapped.year', 2026));
    }

    public function test_year_collects_posts_friends_music_and_games(): void
    {
        $this->travelTo(now()->setDate(2026, 6, 10)->setTime(12, 0));
        $me = User::factory()->create();
        $friend = User::factory()->create();
        app(FriendshipService::class)->request($me, $friend);
        app(FriendshipService::class)->accept($friend, $me);
        $chat = app(Messenger::class)->direct($me, $friend);
        foreach (['привіт', 'граємо?', 'го'] as $text) {
            app(Messenger::class)->send($chat, $me, $text);
        }

        $post = Post::query()->create(['author_id' => $me->id, 'wall_type' => $me->getMorphClass(), 'wall_id' => $me->id, 'body' => 'Мій найкращий пост', 'visibility' => 'public']);
        $post->forceFill(['likes_count' => 7])->save();

        $track = Track::query()->create(['user_id' => $me->id, 'title' => 'Neon Skyline', 'artist' => 'Nightdrive', 'duration' => 200, 'path' => 'music/a.mp3', 'mime' => 'audio/mpeg', 'size' => 1]);
        $music = app(MusicService::class);
        $music->nowPlaying($me, $track);
        $music->nowPlaying($me, $track); // той самий трек одразу — не рахується вдруге
        $this->travel(30)->minutes();
        $music->nowPlaying($me, $track);
        $music->nowPlaying($me, null, ['title' => 'Blinding Lights', 'artist' => 'The Weeknd', 'duration' => 200]);

        $game = Game::query()->create(['slug' => 'gta-v', 'name' => 'GTA V', 'letter' => 'G', 'category' => 'pc', 'is_published' => true]);
        app(PlayingStatus::class)->manual($me, 'game', $game->id, null, 1);
        $this->assertDatabaseHas('play_days', ['user_id' => $me->id, 'kind' => 'game', 'subject_id' => $game->id]);

        $this->travelTo(now()->setDate(2026, 12, 2));
        $this->actingAs($me)->get('/wrapped')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('wrapped.posts.count', 1)
            ->where('wrapped.posts.top.likes', 7)
            ->where('wrapped.social.new_friends', 1)
            ->where('wrapped.social.messages', 3)
            ->where('wrapped.social.best_friend.user.id', $friend->id)
            ->where('wrapped.music.plays', 3)
            ->where('wrapped.music.top_tracks.0.title', 'Neon Skyline')
            ->where('wrapped.music.top_tracks.0.plays', 2)
            ->where('wrapped.games.top_games.0.name', 'GTA V')
            ->where('wrapped.games.play_days', 1)
            ->where('wrapped.joined_this_year', true)
            ->has('wrapped.persona'));
    }

    public function test_plugin_can_be_switched_off(): void
    {
        $this->travelTo(now()->setDate(2026, 12, 3));
        app(Plugins::class)->set('wrapped', false);

        $this->actingAs(User::factory()->create())->get('/wrapped')->assertNotFound();
    }
}
