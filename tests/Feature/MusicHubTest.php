<?php

namespace Tests\Feature;

use App\Models\Playlist;
use App\Models\RadioStation;
use App\Models\Track;
use App\Models\User;
use App\Services\MusicService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/** Розділ «Музика» в стилі Apple Music: Головна, Нове, Радіо, Медіатека, Пошук, виконавець, альбом. */
class MusicHubTest extends TestCase
{
    use RefreshDatabase;

    private function track(array $attributes = []): Track
    {
        static $n = 0;
        $n++;

        return Track::query()->create([
            'user_id' => null,
            'title' => "Трек {$n}",
            'artist' => 'Nightdrive',
            'album' => 'Midnight Run',
            'genre' => 'Synthwave',
            'duration' => 180,
            'path' => "music/{$n}.mp3",
            'mime' => 'audio/mpeg',
            'size' => 1,
            ...$attributes,
        ]);
    }

    public function test_old_tabs_redirect_to_new_sections(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/music?tab=mine')->assertRedirect('/music/library/songs');
        $this->actingAs($user)->get('/music?tab=discover')->assertRedirect('/music/new');
        $this->actingAs($user)->get('/music?tab=spotify')->assertRedirect('/music/library/spotify');
    }

    public function test_home_new_radio_and_library_render(): void
    {
        $user = User::factory()->create();
        $track = $this->track();
        app(MusicService::class)->add($user, $track);
        app(MusicService::class)->nowPlaying($user, $track);
        RadioStation::query()->create(['name' => 'Тест FM', 'slug' => 'test-fm', 'stream_url' => 'https://example.com/live.mp3', 'genre' => 'Поп']);

        $this->actingAs($user)->get('/music')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('music/home')
            ->where('home.top_picks.0.key', 'me')
            ->where('home.recently_played.0.id', $track->id)
            ->where('home.replay.tracks.0.id', $track->id));

        $this->actingAs($user)->get('/music/new')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('music/new')
            ->where('data.latest_songs.0.id', $track->id)
            ->where('data.new_albums.0.title', 'Midnight Run')
            ->where('data.genres.0.name', 'Synthwave'));

        $this->actingAs($user)->get('/music/radio')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('music/radio')
            ->where('data.live.0.source', 'radio')
            ->where('data.live.0.url', 'https://example.com/live.mp3')
            ->where('data.genre_stations.0.key', 'genre:Synthwave'));

        $this->actingAs($user)->get('/music/library')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('music/library')
            ->where('data.counts.songs', 1)
            ->where('data.counts.albums', 1)
            ->where('data.recently_added.0.kind', 'album'));
    }

    public function test_favorite_star_adds_to_library_and_filters_favorites(): void
    {
        $user = User::factory()->create();
        $track = $this->track();

        $this->actingAs($user)->postJson("/music/tracks/{$track->id}/favorite")->assertOk()->assertJson(['favorite' => true, 'in_library' => true]);
        $this->assertDatabaseHas('music_library', ['user_id' => $user->id, 'track_id' => $track->id, 'is_favorite' => true]);

        $this->actingAs($user)->get('/music/library/favorites')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('music/library-section')
            ->where('songs.data.0.id', $track->id)
            ->where('songs.data.0.favorite', true));

        $this->actingAs($user)->deleteJson("/music/tracks/{$track->id}/favorite")->assertOk()->assertJson(['favorite' => false, 'in_library' => true]);
    }

    public function test_library_sections_can_be_customized(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post('/music/library/sections', ['sections' => ['songs', 'albums']])->assertRedirect();
        $this->actingAs($user)->get('/music/library')->assertInertia(fn (AssertableInertia $page) => $page->where('sections', ['songs', 'albums']));
        $this->actingAs($user)->post('/music/library/sections', ['sections' => ['nope']])->assertSessionHasErrors('sections.0');
    }

    public function test_search_finds_by_title_and_by_lyrics_line(): void
    {
        $user = User::factory()->create();
        $this->track(['title' => 'Neon Skyline']);
        $this->track(['title' => 'Інша', 'lyrics' => "[00:01.00]Перший рядок\n[00:05.00]Танцюємо під неоном"]);

        $this->actingAs($user)->get('/music/search?q=Neon')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('music/search')
            ->where('results.tracks.0.title', 'Neon Skyline'));

        $this->actingAs($user)->get('/music/search?q=неоном')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('results.lyrics.0.title', 'Інша')
            ->where('results.lyrics.0.lyric', 'Танцюємо під неоном'));

        // Пошук із вибору треку (JSON) працює як раніше.
        $this->actingAs($user)->getJson('/music/search?q=Neon&scope=all')->assertOk()->assertJsonPath('tracks.0.title', 'Neon Skyline');
    }

    public function test_artist_and_album_pages_and_missing_ones(): void
    {
        $user = User::factory()->create();
        $this->track(['track_no' => 2, 'title' => 'Друга', 'quality' => 'lossless']);
        $this->track(['track_no' => 1, 'title' => 'Перша', 'quality' => 'lossless']);

        $this->actingAs($user)->get('/music/album?artist=Nightdrive&title=Midnight%20Run')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('music/album')
            ->where('album.tracks.0.title', 'Перша')
            ->where('album.quality', 'lossless'));
        $this->actingAs($user)->get('/music/artist?name=Nightdrive')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('music/artist')
            ->where('artist.albums.0.title', 'Midnight Run'));

        $this->actingAs($user)->get('/music/artist?name=Nobody')->assertNotFound();
        $this->actingAs($user)->get('/music/album?artist=Nightdrive&title=Nope')->assertNotFound();
    }

    public function test_station_returns_endless_batches_without_repeats(): void
    {
        $user = User::factory()->create();
        $first = $this->track();
        $second = $this->track();

        $this->actingAs($user)->getJson('/music/station?key=genre:Synthwave&exclude[]='.$first->id)->assertOk()
            ->assertJsonCount(1, 'tracks')->assertJsonPath('tracks.0.id', $second->id);
        $this->actingAs($user)->getJson("/music/station?key=track:{$first->id}")->assertOk()->assertJsonCount(2, 'tracks');
        $this->actingAs($user)->getJson('/music/station?key=bad')->assertUnprocessable();
    }

    public function test_tracks_still_processing_are_hidden_from_catalog(): void
    {
        $user = User::factory()->create();
        $this->track(['processing' => true, 'title' => 'Ще обробляється']);

        $this->actingAs($user)->get('/music/new')->assertInertia(fn (AssertableInertia $page) => $page->where('data.latest_songs', []));
    }

    public function test_mixes_charts_replay_and_my_playlists(): void
    {
        $user = User::factory()->create();
        $track = $this->track();
        app(MusicService::class)->nowPlaying($user, $track);
        Playlist::query()->forceCreate(['user_id' => $user->id, 'title' => 'Вечір', 'is_public' => true]);

        $this->actingAs($user)->get('/music/mix/favorites')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('music/mix')->where('tracks.0.id', $track->id));
        $this->actingAs($user)->get('/music/mix/unknown')->assertNotFound();
        $this->actingAs($user)->get('/music/charts')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->where('charts.week.0.id', $track->id));
        $this->actingAs($user)->get('/music/replay')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('replay.plays', 1)->where('replay.tracks.0.id', $track->id));
        $this->actingAs($user)->getJson('/music/playlists/mine')->assertOk()->assertJsonPath('playlists.0.title', 'Вечір');
        $this->assertSame(1, DB::table('music_plays')->where('user_id', $user->id)->count());
    }
}
