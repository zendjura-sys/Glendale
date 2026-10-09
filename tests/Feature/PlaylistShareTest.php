<?php

namespace Tests\Feature;

use App\Models\Playlist;
use App\Models\SpotifyAccount;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Spotify\SpotifyClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PlaylistShareTest extends TestCase
{
    use RefreshDatabase;

    private function track(array $attributes = []): Track
    {
        return Track::query()->create([
            'title' => 'Neon Skyline',
            'artist' => 'Nightdrive Kyiv',
            'genre' => 'Electronic',
            'duration' => 180,
            'path' => 'music/test.mp3',
            'mime' => 'audio/mpeg',
            'size' => 1000,
            ...$attributes,
        ]);
    }

    private function playlist(User $owner): Playlist
    {
        return $owner->playlists()->create([
            'title' => 'Нічний кодинг',
            'is_public' => false,
        ]);
    }

    private function befriend(User $a, User $b): void
    {
        $friendships = app(FriendshipService::class);
        $friendships->request($a, $b);
        $friendships->accept($b, $a);
    }

    public function test_owner_shares_a_playlist_with_a_friend_who_can_add_tracks(): void
    {
        $this->withoutVite();
        $owner = User::factory()->create();
        $friend = User::factory()->create();
        $stranger = User::factory()->create();
        $this->befriend($owner, $friend);
        $playlist = $this->playlist($owner);
        $track = $this->track();

        $this->actingAs($owner)->post(route('playlists.share', $playlist), [
            'username' => $stranger->username,
        ])->assertStatus(422);
        $this->assertDatabaseMissing('playlist_collaborators', ['playlist_id' => $playlist->id]);

        $this->actingAs($owner)->post(route('playlists.share', $playlist), [
            'username' => $friend->username,
        ])->assertRedirect();

        $this->actingAs($friend)->get(route('playlists.show', $playlist))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('music/playlist')
                ->where('can.manage', true)
                ->where('can.own', false)
                ->where('collaborators.0.username', $friend->username));

        $this->actingAs($friend)->postJson(route('playlists.attach', [$playlist, $track]))
            ->assertOk()
            ->assertJsonPath('added', true);
        $this->actingAs($friend)->delete(route('playlists.destroy', $playlist))->assertForbidden();
        $this->actingAs($stranger)->postJson(route('playlists.attach', [$playlist, $track]))->assertForbidden();
    }

    public function test_spotify_playlist_import_attaches_catalog_matches_only(): void
    {
        $owner = User::factory()->create();
        $playlist = $this->playlist($owner);
        $match = $this->track();
        $this->track(['title' => 'Other Song', 'artist' => 'Someone Else', 'genre' => 'Jazz']);
        $owner->spotifyAccount()->create([
            'spotify_id' => 'spotifyuser1234',
            'access_token' => 'token',
            'expires_at' => now()->addHour(),
        ]);

        $this->mock(SpotifyClient::class, function ($mock) use ($match): void {
            $mock->shouldReceive('playlistTracks')->once()->andReturn([
                ['title' => $match->title, 'artist' => $match->artist],
                ['title' => 'Not In Catalog', 'artist' => 'Nobody'],
                ['title' => '', 'artist' => 'Skip'],
            ]);
        });

        $this->actingAs($owner)->post(route('playlists.spotify', $playlist), [
            'playlist' => '37i9dQZF1DXcBWIGoYBM5M',
        ])->assertRedirect();

        $this->assertTrue($playlist->tracks()->whereKey($match->id)->exists());
        $this->assertSame(1, $playlist->fresh()->tracks_count);
        $this->assertSame(1, SpotifyAccount::query()->count());
    }

    public function test_spotify_import_asks_to_connect_an_account(): void
    {
        $owner = User::factory()->create();
        $playlist = $this->playlist($owner);

        $this->actingAs($owner)->post(route('playlists.spotify', $playlist), [
            'playlist' => '37i9dQZF1DXcBWIGoYBM5M',
        ])->assertStatus(409);
    }

    public function test_similar_tracks_prefer_the_same_artist(): void
    {
        $user = User::factory()->create();
        $source = $this->track(['title' => 'Origin']);
        $sameArtist = $this->track(['title' => 'Same Artist', 'genre' => 'Rock']);
        $sameGenre = $this->track(['title' => 'Same Genre', 'artist' => 'Other Band']);
        $this->track(['title' => 'Unrelated', 'artist' => 'Far Away', 'genre' => 'Jazz']);

        $this->actingAs($user)->getJson(route('tracks.similar', $source))
            ->assertOk()
            ->assertJsonPath('tracks.0.title', $sameArtist->title)
            ->assertJsonPath('tracks.1.title', $sameGenre->title)
            ->assertJsonCount(2, 'tracks');
    }
}
