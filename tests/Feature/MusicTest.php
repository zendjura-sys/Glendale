<?php

namespace Tests\Feature;

use App\Models\Playlist;
use App\Models\Post;
use App\Models\SpotifyAccount;
use App\Models\Track;
use App\Models\User;
use App\Services\MusicService;
use App\Support\Modules\ModuleManager;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MusicTest extends TestCase
{
    use RefreshDatabase;

    private const CLIENT_ID = 'abcdefghijklmnopqrstuvwxyz012345';

    private const CLIENT_SECRET = 'ZYXWVUTSRQPONMLKJIHGFEDCBA987654';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        config([
            'services.spotify.accounts_url' => 'https://accounts.spotify.com',
            'services.spotify.api_url' => 'https://api.spotify.com/v1',
            'services.spotify.client_id' => null,
            'services.spotify.client_secret' => null,
            'services.spotify.redirect' => null,
        ]);
    }

    private function track(?User $owner = null, array $attributes = []): Track
    {
        return Track::query()->create([
            'user_id' => $owner?->id,
            'title' => 'Neon Skyline',
            'artist' => 'Nightdrive Kyiv',
            'duration' => 180,
            'path' => 'music/test.mp3',
            'mime' => 'audio/mpeg',
            'size' => 1000,
            ...$attributes,
        ]);
    }

    private function configureSpotify(): void
    {
        $settings = app(SiteSettings::class);
        $settings->put(['spotify_client_id' => self::CLIENT_ID]);
        $settings->putSecret('spotify_client_secret', self::CLIENT_SECRET);
    }

    private function spotifyTrack(string $id = '4uLU6hMCjMI75M1A2tKUQC'): array
    {
        return [
            'id' => $id,
            'name' => 'Never Gonna Give You Up',
            'uri' => "spotify:track:{$id}",
            'duration_ms' => 213000,
            'explicit' => false,
            'artists' => [['name' => 'Rick Astley']],
            'album' => ['name' => 'Whenever You Need Somebody', 'images' => [['url' => 'https://i.scdn.co/image/large'], ['url' => 'https://i.scdn.co/image/medium']]],
            'external_urls' => ['spotify' => "https://open.spotify.com/track/{$id}"],
        ];
    }

    public function test_music_page_renders_library_and_stats(): void
    {
        $user = User::factory()->create();
        $track = $this->track($user);
        app(MusicService::class)->add($user, $track);

        $this->actingAs($user)->get(route('music.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('music/index')
                ->where('tab', 'mine')
                ->where('stats.tracks', 1)
                ->where('stats.duration', 180)
                ->where('spotify.configured', false)
                ->where('tracks.data.0.key', 'local:'.$track->id)
                ->where('tracks.data.0.in_library', true)
                ->where('music.spotify.connected', false));
    }

    public function test_user_can_upload_a_track(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('tracks.store'), [
            'audio' => UploadedFile::fake()->create('song.mp3', 800, 'audio/mpeg'),
            'title' => '  Респаун ',
            'artist' => 'Lag Spike',
            'genre' => 'Electronic',
            'duration' => 201,
        ])->assertCreated()->assertJsonPath('track.title', 'Респаун')->assertJsonPath('track.in_library', true);

        $track = Track::query()->sole();
        Storage::disk('public')->assertExists($track->path);
        $this->assertSame(1, $track->adds_count);
        $this->assertTrue($user->library()->whereKey($track->id)->exists());
    }

    public function test_upload_rejects_non_audio_and_oversized_files(): void
    {
        $user = User::factory()->create();
        app(SiteSettings::class)->put(['music_max_track_mb' => 1]);

        $this->actingAs($user)->postJson(route('tracks.store'), [
            'audio' => UploadedFile::fake()->create('virus.exe', 10, 'application/octet-stream'),
            'title' => 'x',
            'artist' => 'y',
        ])->assertJsonValidationErrors('audio');

        $this->actingAs($user)->postJson(route('tracks.store'), [
            'audio' => UploadedFile::fake()->create('big.mp3', 2048, 'audio/mpeg'),
            'title' => 'x',
            'artist' => 'y',
        ])->assertJsonValidationErrors('audio');

        $this->assertSame(0, Track::query()->count());
    }

    public function test_library_add_and_remove_and_non_owner_cannot_edit(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $track = $this->track($owner);

        $this->actingAs($other)->postJson(route('tracks.add', $track))->assertOk();
        $this->actingAs($other)->postJson(route('tracks.add', $track))->assertOk();
        $this->assertSame(1, $track->fresh()->adds_count);

        $this->actingAs($other)->patchJson(route('tracks.update', $track), ['title' => 'Hacked', 'artist' => 'x'])->assertForbidden();

        $this->actingAs($other)->deleteJson(route('tracks.destroy', $track))->assertJsonPath('removed', true);
        $this->assertNotSoftDeleted($track);
        $this->assertFalse($other->library()->whereKey($track->id)->exists());

        $this->actingAs($owner)->deleteJson(route('tracks.destroy', $track))->assertJsonPath('deleted', true);
        $this->assertSoftDeleted($track);
    }

    public function test_playlists_can_be_managed_and_private_ones_are_hidden(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        [$a, $b] = [$this->track($owner, ['duration' => 100]), $this->track($owner, ['title' => 'Second', 'duration' => 50])];

        $this->actingAs($owner)->post(route('playlists.store'), ['title' => 'Нічний кодинг', 'is_public' => false])->assertRedirect();
        $playlist = Playlist::query()->sole();

        $this->actingAs($owner)->postJson(route('playlists.attach', [$playlist, $a]))->assertJsonPath('added', true);
        $this->actingAs($owner)->postJson(route('playlists.attach', [$playlist, $a]))->assertJsonPath('added', false);
        $this->actingAs($owner)->postJson(route('playlists.attach', [$playlist, $b]))->assertJsonPath('tracks_count', 2);
        $this->assertSame(150, $playlist->fresh()->duration);

        $this->actingAs($stranger)->postJson(route('playlists.attach', [$playlist, $a]))->assertForbidden();
        $this->actingAs($stranger)->get(route('playlists.show', $playlist))->assertNotFound();

        $this->actingAs($owner)->get(route('playlists.show', $playlist))
            ->assertInertia(fn (Assert $page) => $page
                ->component('music/playlist')
                ->has('tracks', 2)
                ->where('tracks.0.title', 'Neon Skyline')
                ->where('can.manage', true));

        $this->actingAs($owner)->deleteJson(route('playlists.detach', [$playlist, $a]))->assertJsonPath('tracks_count', 1);
        $this->actingAs($owner)->delete(route('playlists.destroy', $playlist))->assertRedirect(route('music.index', ['tab' => 'playlists']));
        $this->assertModelMissing($playlist);
    }

    public function test_post_can_carry_a_local_or_spotify_track(): void
    {
        $user = User::factory()->create();
        $track = $this->track($user);

        $this->actingAs($user)->post(route('posts.store'), ['visibility' => 'public', 'music' => ['source' => 'local', 'id' => $track->id]])->assertRedirect();
        $this->assertSame(['source' => 'local', 'id' => $track->id], Post::query()->latest('id')->first()->music);

        $this->actingAs($user)->post(route('posts.store'), [
            'body' => 'Класика',
            'visibility' => 'public',
            'music' => [
                'source' => 'spotify',
                'id' => '4uLU6hMCjMI75M1A2tKUQC',
                'title' => 'Never Gonna Give You Up',
                'artist' => 'Rick Astley',
                'duration' => 213,
                'cover_url' => 'https://evil.example.com/tracker.png',
            ],
        ])->assertRedirect();
        $music = Post::query()->latest('id')->first()->music;
        $this->assertSame('spotify:4uLU6hMCjMI75M1A2tKUQC', $music['key']);
        $this->assertNull($music['cover_url']);

        $this->actingAs($user)->post(route('posts.store'), ['visibility' => 'public', 'music' => ['source' => 'spotify', 'id' => '../../etc', 'title' => 'x', 'artist' => 'y']])
            ->assertSessionHasErrors('music');

        $this->actingAs($user)->get(route('feed'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('posts.data.0.music.source', 'spotify')
                ->where('posts.data.1.music.key', 'local:'.$track->id)
                ->where('posts.data.1.music.in_library', false));
    }

    public function test_now_playing_is_shown_on_profile(): void
    {
        $user = User::factory()->create();
        $viewer = User::factory()->create();
        $track = $this->track($user);

        $this->actingAs($user)->postJson(route('music.now-playing'), ['source' => 'local', 'track_id' => $track->id])->assertOk();
        $this->assertSame(1, $track->fresh()->plays_count);

        $this->actingAs($viewer)->get(route('profile.show', $user))
            ->assertInertia(fn (Assert $page) => $page
                ->where('audio.href', '/music/u/'.$user->username)
                ->missing('nowPlaying')
                ->loadDeferredProps(fn (Assert $reload) => $reload->where('nowPlaying.key', 'local:'.$track->id)->where('nowPlaying.via', 'gamecon')->where('nowPlaying.in_library', false)));

        $this->actingAs($viewer)->postJson(route('tracks.add', $track))->assertOk();

        $this->actingAs($viewer)->get(route('music.user', $user))
            ->assertInertia(fn (Assert $page) => $page
                ->loadDeferredProps(fn (Assert $reload) => $reload->where('nowPlaying.key', 'local:'.$track->id)->where('nowPlaying.in_library', true)));

        $this->actingAs($user)->get(route('profile.show', $user))
            ->assertInertia(fn (Assert $page) => $page
                ->loadDeferredProps(fn (Assert $reload) => $reload->where('nowPlaying.in_library', false)));

        $this->actingAs($user)->deleteJson(route('music.now-playing'))->assertOk();
        $this->assertNull(app(MusicService::class)->currentFor($user->fresh()));
    }

    public function test_admin_saves_spotify_keys_encrypted_and_never_exposes_the_secret(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->put(route('admin.integrations.spotify'), ['client_id' => 'short', 'client_secret' => 'bad'])
            ->assertSessionHasErrors(['client_id', 'client_secret']);

        $this->actingAs($admin)->put(route('admin.integrations.spotify'), ['client_id' => self::CLIENT_ID, 'client_secret' => self::CLIENT_SECRET])
            ->assertSessionHasNoErrors();

        $raw = DB::table('site_settings')->where('key', 'spotify_client_secret')->value('value');
        $this->assertStringNotContainsString(self::CLIENT_SECRET, (string) $raw);
        $this->assertSame(self::CLIENT_SECRET, app(SiteSettings::class)->secret('spotify_client_secret'));

        $this->actingAs($admin)->put(route('admin.integrations.spotify'), ['client_id' => self::CLIENT_ID, 'client_secret' => ''])->assertSessionHasNoErrors();
        $this->assertSame(self::CLIENT_SECRET, app(SiteSettings::class)->secret('spotify_client_secret'));

        $page = $this->actingAs($admin)->get(route('admin.integrations.index'));
        $page->assertInertia(fn (Assert $p) => $p
            ->component('admin/integrations')
            ->where('spotify.configured', true)
            ->where('spotify.client_id', self::CLIENT_ID)
            ->where('spotify.redirect_uri', route('spotify.callback')));
        $this->assertStringNotContainsString(self::CLIENT_SECRET, $page->getContent());

        $this->actingAs($admin)->get(route('admin.settings.edit'))->assertDontSee(self::CLIENT_SECRET);

        Http::fake(['accounts.spotify.com/api/token' => Http::response(['access_token' => 'app-token', 'expires_in' => 3600])]);
        $this->actingAs($admin)->post(route('admin.integrations.spotify.test'))->assertSessionHasNoErrors();
        Http::assertSent(fn ($request) => $request->hasHeader('Authorization', 'Basic '.base64_encode(self::CLIENT_ID.':'.self::CLIENT_SECRET)));

        $this->actingAs($admin)->put(route('admin.integrations.spotify'), ['clear' => true]);
        $this->assertNull(app(SiteSettings::class)->secret('spotify_client_secret'));

        $this->actingAs(User::factory()->create())->put(route('admin.integrations.spotify'), ['client_id' => self::CLIENT_ID])->assertForbidden();
    }

    public function test_spotify_oauth_connects_account_and_checks_state(): void
    {
        $this->configureSpotify();
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('spotify.callback', ['code' => 'abc', 'state' => 'forged']))
            ->assertRedirect(route('music.index', ['tab' => 'spotify']));
        $this->assertSame(0, SpotifyAccount::query()->count());

        $redirect = (string) $this->actingAs($user)->get(route('spotify.connect'))->assertRedirect()->headers->get('Location');
        $this->assertStringStartsWith('https://accounts.spotify.com/authorize?', $redirect);
        parse_str((string) parse_url($redirect, PHP_URL_QUERY), $query);
        $this->assertSame(self::CLIENT_ID, $query['client_id']);
        $this->assertSame(route('spotify.callback'), $query['redirect_uri']);

        Http::fake([
            'accounts.spotify.com/api/token' => Http::response(['access_token' => 'user-token', 'refresh_token' => 'refresh', 'expires_in' => 3600, 'scope' => 'streaming']),
            'api.spotify.com/v1/me' => Http::response(['id' => 'mark_spotify', 'display_name' => 'Mark', 'product' => 'premium', 'country' => 'UA', 'images' => []]),
            'api.spotify.com/v1/search*' => Http::response(['tracks' => ['items' => [$this->spotifyTrack()]]]),
        ]);

        $this->actingAs($user)->get(route('spotify.callback', ['code' => 'abc', 'state' => $query['state']]))->assertRedirect();

        $account = SpotifyAccount::query()->sole();
        $this->assertTrue($account->isPremium());
        $this->assertSame('user-token', $account->access_token);
        $this->assertStringNotContainsString('user-token', (string) DB::table('spotify_accounts')->value('access_token'));

        $this->actingAs($user)->getJson(route('spotify.token'))->assertJsonPath('access_token', 'user-token');
        $this->actingAs($user)->getJson(route('spotify.search', ['q' => 'rick']))
            ->assertJsonPath('tracks.0.key', 'spotify:4uLU6hMCjMI75M1A2tKUQC')
            ->assertJsonPath('tracks.0.cover_url', 'https://i.scdn.co/image/medium');

        $this->actingAs($user)->get(route('music.index'))
            ->assertInertia(fn (Assert $page) => $page->where('music.spotify.connected', true)->where('music.spotify.premium', true));

        $this->actingAs($user)->delete(route('spotify.disconnect'))->assertRedirect();
        $this->assertSame(0, SpotifyAccount::query()->count());
    }

    public function test_spotify_endpoints_fail_gracefully_when_not_configured(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('spotify.connect'))->assertRedirect(route('music.index', ['tab' => 'spotify']));
        $this->actingAs($user)->getJson(route('spotify.search', ['q' => 'x']))->assertStatus(503);
    }

    public function test_admin_can_moderate_tracks(): void
    {
        $admin = User::factory()->admin()->create();
        Storage::disk('public')->put('music/test.mp3', 'x');
        $track = $this->track(User::factory()->create());

        $this->actingAs($admin)->get(route('admin.music.index'))
            ->assertInertia(fn (Assert $page) => $page->component('admin/music')->where('stats.tracks', 1)->has('tracks.data', 1));

        $this->actingAs($admin)->delete(route('admin.music.destroy', $track->id));
        $this->assertSoftDeleted($track);
        $this->actingAs($admin)->post(route('admin.music.restore', $track->id));
        $this->assertNotSoftDeleted($track);

        $this->actingAs($admin)->delete(route('admin.music.destroy', $track->id));
        $this->actingAs($admin)->delete(route('admin.music.destroy', $track->id));
        $this->assertModelMissing($track);
        Storage::disk('public')->assertMissing('music/test.mp3');
    }

    public function test_module_can_be_disabled(): void
    {
        $user = User::factory()->create();
        app(ModuleManager::class)->set('music', false);

        $this->actingAs($user)->get(route('music.index'))->assertNotFound();
        $this->actingAs($user)->get(route('feed'))->assertInertia(fn (Assert $page) => $page->where('music', null));
    }
}
