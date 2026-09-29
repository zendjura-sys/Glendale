<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSyncRun;
use App\Cinema\Episode;
use App\Cinema\Kodik\KodikItemSynchronizer;
use App\Cinema\Season;
use App\Cinema\Title;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KodikItemSynchronizerTest extends TestCase
{
    use RefreshDatabase;

    private function run(): CinemaSyncRun
    {
        return CinemaSyncRun::create([
            'source' => 'kodik',
            'mode' => 'incremental',
            'status' => 'running',
            'initiator' => 'scheduler',
            'started_at' => now(),
        ]);
    }

    public function test_creates_and_publishes_new_title_only_with_valid_iframe(): void
    {
        $result = app(KodikItemSynchronizer::class)->sync([
            'id' => 'anime-4001',
            'type' => 'anime-serial',
            'title' => 'Нове аніме',
            'title_orig' => 'New Anime',
            'year' => 2026,
            'shikimori_id' => 4001,
            'link' => '//kodik.info/serial/4001/8/720p',
            'translation' => ['id' => 8, 'title' => 'Українська', 'type' => 'voice'],
            'quality' => 'WEB-DL 1080p',
            'last_season' => 2,
            'last_episode' => 12,
            'material_data' => [
                'description' => 'Опис із Kodik.',
                'poster_url' => 'https://img.example/anime-4001.jpg',
                'countries' => ['Японія'],
            ],
        ], $this->run());

        $title = $result->title?->fresh();
        $this->assertSame('created', $result->status);
        $this->assertNotNull($title);
        $this->assertTrue($title->is_published);
        $this->assertSame('anime', $title->category);
        $this->assertSame('anime-4001', $title->kodik_id);
        $this->assertSame('https://kodik.info/serial/4001/8/720p', $title->kodik_link);
        $this->assertSame(1, $title->kodikSources()->count());
        $this->assertSame('created', $result->event->action);
        $this->assertSame('succeeded', $result->event->status);
    }

    public function test_updates_existing_title_without_losing_manual_data_flixcdn_or_episodes(): void
    {
        $title = Title::create([
            'tmdb_id' => 4101,
            'type' => 'series',
            'name' => 'Ручна назва',
            'overview' => 'Ручний опис',
            'imdb_id' => 'tt4101',
            'flixcdn_link' => 'https://player.uacdn.live/embed/4101',
        ]);
        $season = Season::create(['title_id' => $title->id, 'number' => 1, 'name' => 'Ручний сезон']);
        $episode = Episode::create(['title_id' => $title->id, 'season_id' => $season->id, 'number' => 1, 'name' => 'Ручна серія']);

        $result = app(KodikItemSynchronizer::class)->sync([
            'id' => 'serial-4101',
            'type' => 'foreign-serial',
            'title' => 'Назва з Kodik',
            'imdb_id' => 'tt4101',
            'link' => '//kodik.info/serial/4101/2/720p',
            'translation' => ['id' => 2, 'title' => 'Озвучка'],
            'material_data' => ['description' => 'Опис з API'],
        ], $this->run());

        $title->refresh();
        $this->assertSame('updated', $result->status);
        $this->assertSame($title->id, $result->title?->id);
        $this->assertSame('Ручна назва', $title->name);
        $this->assertSame('Ручний опис', $title->overview);
        $this->assertSame('https://player.uacdn.live/embed/4101', $title->flixcdn_link);
        $this->assertSame('Ручний сезон', $season->fresh()->name);
        $this->assertSame('Ручна серія', $episode->fresh()->name);
        $this->assertSame(1, $title->seasons()->count());
        $this->assertSame(1, $season->episodes()->count());
    }

    public function test_upserts_all_translations_and_selects_ukrainian_source_deterministically(): void
    {
        $result = app(KodikItemSynchronizer::class)->sync([
            'id' => 'serial-4201',
            'type' => 'anime-serial',
            'title' => 'Переклади',
            'year' => 2026,
            'translations' => [
                [
                    'link' => '//kodik.info/serial/4201/10/720p',
                    'translation' => ['id' => 10, 'title' => 'Українська'],
                    'quality' => '720p', 'last_season' => 1, 'last_episode' => 6,
                ],
                [
                    'link' => '//kodik.info/serial/4201/11/1080p',
                    'translation' => ['id' => 11, 'title' => 'LostFilm'],
                    'quality' => '1080p', 'last_season' => 3, 'last_episode' => 24,
                ],
            ],
        ], $this->run());

        $title = $result->title?->fresh();
        $this->assertCount(2, $title->kodikSources);
        $this->assertCount(2, $title->kodik_translations);
        $this->assertSame('https://kodik.info/serial/4201/10/720p', $title->kodik_link);
        $this->assertSame('Українська', $title->kodik_translations[0]['title']);

        app(KodikItemSynchronizer::class)->sync([
            'id' => 'serial-4201',
            'type' => 'anime-serial',
            'title' => 'Переклади',
            'translations' => [[
                'link' => '//kodik.info/serial/4201/10/new-1080p',
                'translation' => ['id' => 10, 'title' => 'Українська'],
                'quality' => '1080p',
            ]],
        ], $this->run());

        $this->assertSame(2, $title->kodikSources()->count(), 'Repeated sync updates the source instead of duplicating it.');
        $this->assertSame('https://kodik.info/serial/4201/10/new-1080p', $title->fresh()->kodik_link);
    }

    public function test_priority_identity_conflict_replaces_selected_title_kodik_data(): void
    {
        $imdb = Title::create(['tmdb_id' => 4301, 'type' => 'movie', 'name' => 'IMDb', 'imdb_id' => 'tt4301']);
        $kinopoisk = Title::create(['tmdb_id' => 4302, 'type' => 'movie', 'name' => 'KP', 'kinopoisk_id' => 'kp-4302', 'imdb_id' => 'tt-old']);

        $result = app(KodikItemSynchronizer::class)->sync([
            'id' => 'movie-4302',
            'type' => 'foreign-movie',
            'title' => 'Заміна',
            'kinopoisk_id' => 'kp-4302',
            'imdb_id' => 'tt4301',
            'link' => '//kodik.info/video/4302/1/720p',
            'translation' => ['id' => 1, 'title' => 'Дубляж'],
        ], $this->run());

        $this->assertSame('updated', $result->status);
        $this->assertSame($kinopoisk->id, $result->title?->id);
        $this->assertSame('tt4301', $kinopoisk->fresh()->imdb_id);
        $this->assertNull($imdb->fresh()->kodik_link);
    }

    public function test_ambiguous_identity_is_logged_without_creating_or_changing_title(): void
    {
        Title::create(['tmdb_id' => 4401, 'type' => 'movie', 'name' => 'Однаково', 'year' => 2025]);
        Title::create(['tmdb_id' => 4402, 'type' => 'movie', 'name' => 'Однаково', 'year' => 2026]);

        $result = app(KodikItemSynchronizer::class)->sync([
            'id' => 'movie-4400',
            'type' => 'foreign-movie',
            'title' => 'Однаково',
            'year' => 2026,
            'link' => '//kodik.info/video/4400/1/720p',
            'translation' => ['id' => 1, 'title' => 'Дубляж'],
        ], $this->run());

        $this->assertSame('ambiguous', $result->status);
        $this->assertNull($result->title);
        $this->assertSame(2, Title::count());
        $this->assertSame('identity_conflict', $result->event->action);
        $this->assertSame('ambiguous', $result->event->status);
    }

    public function test_missing_iframe_is_logged_and_does_not_publish_new_title(): void
    {
        $result = app(KodikItemSynchronizer::class)->sync([
            'id' => 'movie-4501',
            'type' => 'foreign-movie',
            'title' => 'Без iframe',
            'year' => 2026,
            'link' => '',
            'translation' => ['id' => 1, 'title' => 'Дубляж'],
        ], $this->run());

        $this->assertSame('rejected', $result->status);
        $this->assertNull($result->title);
        $this->assertSame(0, Title::count());
        $this->assertSame('skipped', $result->event->action);
        $this->assertSame('missing_iframe', $result->event->message);
    }
}
