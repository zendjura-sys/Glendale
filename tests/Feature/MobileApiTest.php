<?php

namespace Tests\Feature;

use App\Models\Track;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MobileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_feed_and_post(): void
    {
        $user = User::factory()->create(['email' => 'player@gamecon.test']);

        $this->getJson('/api/v1/me')->assertUnauthorized();

        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'player@gamecon.test',
            'password' => 'password',
            'device' => 'GameCon',
        ])->assertOk()->json('token');

        $this->assertIsString($token);

        $this->withToken($token)->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'player@gamecon.test');

        $this->withToken($token)->getJson('/api/v1/feed')
            ->assertOk()
            ->assertJsonStructure(['tab', 'posts' => ['data', 'current_page']]);

        $this->withToken($token)->postJson('/api/v1/posts', [
            'body' => 'Перший запис із застосунку',
            'visibility' => 'public',
        ])->assertCreated()->assertJsonPath('post.body', 'Перший запис із застосунку');

        $this->withToken($token)->getJson('/api/v1/friends')->assertOk()->assertJsonPath('counts.all', 0);
        $this->withToken($token)->getJson('/api/v1/messages')->assertOk()->assertJsonStructure(['conversations', 'unread']);
        $this->withToken($token)->getJson('/api/v1/communities')->assertOk();
        $this->withToken($token)->getJson('/api/v1/music')->assertOk();
        $this->withToken($token)->getJson('/api/v1/cinema')->assertOk();
        $this->withToken($token)->getJson('/api/v1/families')->assertOk();
        $this->withToken($token)->getJson('/api/v1/servers')->assertOk();
        $this->withToken($token)->getJson('/api/v1/notifications')->assertOk();

        $this->withToken($token)->postJson('/api/v1/logout')->assertOk();
        $this->withToken($token)->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_register_and_discord_start(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'first_name' => 'Марко',
            'last_name' => 'Скалетта',
            'email' => 'marco@gamecon.test',
            'password' => 'password-123',
            'password_confirmation' => 'password-123',
        ])->assertCreated()->assertJsonPath('user.first_name', 'Марко');

        app(SiteSettings::class)->put([
            'discord_client_id' => '123456789012345678',
        ]);
        app(SiteSettings::class)->putSecret('discord_client_secret', 'discord-secret-value-123456');

        $this->postJson('/api/v1/auth/discord')
            ->assertOk()
            ->assertJsonStructure(['url']);
    }

    public function test_album_playlist_and_friend_request_state(): void
    {
        Storage::fake('public');
        $user = User::factory()->create(['email' => 'player@gamecon.test']);
        $other = User::factory()->create();
        $token = $this->postJson('/api/v1/auth/login', [
            'email' => 'player@gamecon.test',
            'password' => 'password',
        ])->assertOk()->json('token');

        $album = $this->withToken($token)->postJson('/api/v1/albums', [
            'title' => 'Літо',
            'privacy' => 'friends',
        ])->assertCreated()->assertJsonPath('album.title', 'Літо')->json('album.id');

        $this->withToken($token)->post('/api/v1/albums/'.$album.'/photos', [
            'photos' => [UploadedFile::fake()->image('shot.jpg')],
        ])->assertCreated()->assertJsonPath('count', 1);

        $this->withToken($token)->postJson('/api/v1/music/playlists', [
            'title' => 'Ніч',
            'is_public' => false,
        ])->assertCreated()->assertJsonPath('playlist.title', 'Ніч');

        $this->withToken($token)->postJson('/api/v1/friends/'.$other->username)
            ->assertOk()
            ->assertJsonPath('relation', 'outgoing');

        $this->withToken($token)->getJson('/api/v1/people?q='.urlencode($other->username))
            ->assertOk()
            ->assertJsonPath('users.data.0.relation', 'outgoing');

        $this->withToken($token)->deleteJson('/api/v1/friends/'.$other->username)
            ->assertOk()
            ->assertJsonPath('relation', 'none');
    }

    public function test_app_uploads_a_track_with_token(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $token = app(ApiTokens::class)->issue($user, 'android');

        // Раніше застосунок отримував 500 (ArgumentCountError): міст не передавав AudioProbe у TrackController::store.
        $this->withToken($token)->post('/api/v1/music/tracks', [
            'audio' => UploadedFile::fake()->create('song.mp3', 800, 'audio/mpeg'),
            'title' => 'Респаун',
            'artist' => 'Lag Spike',
            'duration' => 201,
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('track.title', 'Респаун')
            ->assertJsonPath('track.in_library', true);

        $track = Track::query()->sole();
        $this->assertSame($user->id, $track->user_id);
        Storage::disk('public')->assertExists($track->path);
    }

    public function test_wrong_password(): void
    {
        User::factory()->create(['email' => 'player@gamecon.test']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'player@gamecon.test',
            'password' => 'nope-nope',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }
}
