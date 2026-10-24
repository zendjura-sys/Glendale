<?php

namespace Tests\Feature;

use App\Models\MusicStatus;
use App\Models\SpotifyAccount;
use App\Models\Track;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\FriendshipService;
use App\Services\MusicService;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** «Показувати, що я слухаю»: одне налаштування сайту й застосунку для всієї музики. */
class ShowListeningTest extends TestCase
{
    use RefreshDatabase;

    private function track(): Track
    {
        return Track::query()->create([
            'title' => 'Neon Skyline',
            'artist' => 'Nightdrive Kyiv',
            'duration' => 180,
            'path' => 'music/test.mp3',
            'mime' => 'audio/mpeg',
            'size' => 1000,
        ]);
    }

    /**
     * @return array{User, User, Track}
     */
    private function friendsListening(): array
    {
        $owner = User::factory()->create();
        $friend = User::factory()->create();
        app(FriendshipService::class)->request($owner, $friend);
        app(FriendshipService::class)->accept($friend, $owner);
        $track = $this->track();
        app(MusicService::class)->nowPlaying($owner, $track);

        return [$owner, $friend, $track];
    }

    public function test_on_by_default_and_shared_with_site_and_app(): void
    {
        [$owner, $friend, $track] = $this->friendsListening();
        $token = app(ApiTokens::class)->issue($owner, 'android');

        $this->assertTrue($owner->showsListening());
        $this->actingAs($owner)->get('/settings/profile')->assertInertia(fn (Assert $page) => $page->where('auth.user.show_listening', true));
        $this->withToken($token)->getJson('/api/v1/me')->assertOk()->assertJsonPath('user.show_listening', true);
        $this->assertSame('local:'.$track->id, app(MusicService::class)->currentFor($owner, $friend)['key'] ?? null);
        $this->actingAs($friend)->get('/music')->assertInertia(fn (Assert $page) => $page->where('home.friends.0.user.id', $owner->id));
    }

    public function test_turning_off_hides_now_playing_from_others_but_not_from_the_owner(): void
    {
        [$owner, $friend, $track] = $this->friendsListening();

        $this->actingAs($owner)->from('/settings/profile')->patch('/settings/listening', ['show_listening' => false])
            ->assertRedirect('/settings/profile');
        $owner->refresh();
        $this->assertFalse($owner->showsListening());
        $this->actingAs($owner)->get('/settings/profile')->assertInertia(fn (Assert $page) => $page->where('auth.user.show_listening', false));

        // Профіль і сторінка музики людини.
        $this->actingAs($friend)->get(route('profile.show', $owner))
            ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload->where('nowPlaying', fn ($now) => $now === null)));
        $this->actingAs($friend)->get(route('music.user', $owner))
            ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload->where('nowPlaying', fn ($now) => $now === null)));
        $this->assertNull(app(MusicService::class)->currentFor($owner));

        // «Зараз слухають» на головній музики — на сайті й через міст застосунку.
        $this->actingAs($friend)->get('/music')->assertInertia(fn (Assert $page) => $page->where('home.friends', []));
        $token = app(ApiTokens::class)->issue($friend, 'android');
        $this->withToken($token)->getJson('/api/v1/site/music/home')->assertOk()->assertJsonPath('home.friends', []);

        // Власник бачить своє, його історія («Replay») пишеться далі.
        $this->actingAs($owner)->get(route('profile.show', $owner))
            ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload->where('nowPlaying.key', 'local:'.$track->id)));
        app(MusicService::class)->nowPlaying($owner, $track);
        $this->assertSame(1, MusicStatus::query()->whereKey($owner->id)->count());
        $ownerToken = app(ApiTokens::class)->issue($owner, 'android');
        $this->withToken($ownerToken)->postJson('/api/v1/music/now-playing', ['track_id' => $track->id])
            ->assertOk()->assertJsonPath('now.key', 'local:'.$track->id);

        // Знову ввімкнули — друзі бачать.
        $this->actingAs($owner)->patch('/settings/listening', ['show_listening' => true]);
        $this->actingAs($friend)->get('/music')->assertInertia(fn (Assert $page) => $page->where('home.friends.0.user.id', $owner->id));
    }

    public function test_spotify_is_shown_only_when_both_switches_are_on(): void
    {
        $settings = app(SiteSettings::class);
        $settings->put(['spotify_client_id' => 'abcdefghijklmnopqrstuvwxyz012345']);
        $settings->putSecret('spotify_client_secret', 'secretsecretsecretsecretsecret12');
        Http::fake(['api.spotify.com/v1/me/player/currently-playing' => Http::response([
            'is_playing' => true,
            'progress_ms' => 1000,
            'item' => [
                'type' => 'track',
                'id' => '4uLU6hMCjMI75M1A2tKUQC',
                'name' => 'Never Gonna Give You Up',
                'uri' => 'spotify:track:4uLU6hMCjMI75M1A2tKUQC',
                'duration_ms' => 213000,
                'explicit' => false,
                'artists' => [['name' => 'Rick Astley']],
                'album' => ['name' => 'Whenever You Need Somebody', 'images' => []],
                'external_urls' => ['spotify' => 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'],
            ],
        ])]);
        $owner = User::factory()->create();
        $viewer = User::factory()->create();
        $owner->spotifyAccount()->save(new SpotifyAccount([
            'spotify_id' => 'dj', 'display_name' => 'DJ', 'product' => 'premium',
            'access_token' => 'token', 'refresh_token' => 'refresh', 'expires_at' => now()->addHour(), 'show_now_playing' => true,
        ]));
        $music = app(MusicService::class);

        $this->assertSame('spotify', $music->currentFor($owner, $viewer)['via'] ?? null);

        $this->actingAs($owner)->patch('/settings/listening', ['show_listening' => false]);
        $this->assertNull($music->currentFor($owner->fresh(), $viewer));

        $this->actingAs($owner)->patch('/settings/listening', ['show_listening' => true]);
        $this->actingAs($owner)->patch('/music/spotify', ['show_now_playing' => false]);
        $this->assertNull($music->currentFor($owner->fresh(), $viewer));
    }

    public function test_app_changes_the_same_setting_through_the_bridge(): void
    {
        $user = User::factory()->create();
        $token = app(ApiTokens::class)->issue($user, 'android');

        $this->withToken($token)->patchJson('/api/v1/site/settings/listening', ['show_listening' => false])
            ->assertOk()->assertJsonPath('ok', true);
        $this->assertFalse($user->fresh()->showsListening());
        $this->withToken($token)->getJson('/api/v1/me')->assertJsonPath('user.show_listening', false);
        $this->withToken($token)->patchJson('/api/v1/site/settings/listening', ['show_listening' => 'так'])->assertUnprocessable();
    }
}
