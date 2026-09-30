<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncRun;
use App\Cinema\Kodik\KodikItemSynchronizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class KodikEnrichmentTest extends TestCase
{
    use RefreshDatabase;

    private function syncRun(): CinemaSyncRun
    {
        return CinemaSyncRun::create(['source' => 'kodik', 'mode' => 'incremental', 'status' => 'running']);
    }

    public function test_new_title_uses_localized_tmdb_metadata_found_by_exact_imdb_id(): void
    {
        CinemaSettings::setSecret(CinemaSettings::TMDB_KEY, 'tmdb-test-key');
        Http::preventStrayRequests();
        Http::fake([
            'api.themoviedb.org/3/find/tt1234567*' => Http::response(['movie_results' => [['id' => 901]]]),
            'api.themoviedb.org/3/movie/901*' => Http::response([
                'id' => 901, 'title' => 'Українська назва', 'original_title' => 'Original',
                'overview' => 'Український опис', 'poster_path' => '/poster.jpg',
                'release_date' => '2024-01-01', 'runtime' => 105,
            ]),
        ]);
        $result = app(KodikItemSynchronizer::class)->sync([
            'id' => 'movie-localized', 'type' => 'foreign-movie', 'title' => 'Название Kodik',
            'imdb_id' => 'tt1234567', 'link' => 'https://kodik.info/video/localized',
        ], $this->syncRun());
        $this->assertSame('Українська назва', $result->title->name);
        $this->assertSame('Український опис', $result->title->overview);
        $this->assertSame('https://image.tmdb.org/t/p/w500/poster.jpg', $result->title->poster_path);
        $this->assertSame(105, $result->title->runtime);
    }

    public function test_missing_anime_metadata_uses_exact_shikimori_id(): void
    {
        Http::preventStrayRequests();
        Http::fake(['shikimori.one/api/animes/12345' => Http::response([
            'id' => 12345, 'name' => 'Anime', 'russian' => 'Название аниме',
            'description' => '<p>Описание аниме</p>', 'image' => ['original' => '/anime.jpg'],
            'aired_on' => '2023-01-01',
        ])]);
        $result = app(KodikItemSynchronizer::class)->sync([
            'id' => 'serial-anime', 'type' => 'anime-serial', 'title' => 'Anime',
            'shikimori_id' => 12345, 'link' => 'https://kodik.info/serial/anime',
        ], $this->syncRun());
        $this->assertSame('Название аниме', $result->title->name);
        $this->assertSame('Описание аниме', $result->title->overview);
        $this->assertSame('https://shikimori.one/anime.jpg', $result->title->poster_path);
    }

    public function test_optional_enrichment_failure_keeps_valid_kodik_title_and_player(): void
    {
        CinemaSettings::setSecret(CinemaSettings::TMDB_KEY, 'tmdb-private-key');
        Http::fake(['api.themoviedb.org/*' => Http::response(['status_message' => 'Temporary'], 503)]);
        $result = app(KodikItemSynchronizer::class)->sync([
            'id' => 'movie-fallback', 'type' => 'foreign-movie', 'title' => 'Fallback',
            'imdb_id' => 'tt1234567', 'link' => 'https://kodik.info/video/fallback',
            'material_data' => ['description' => 'Kodik description'],
        ], $this->syncRun());
        $this->assertSame('Kodik description', $result->title->overview);
        $this->assertSame('https://kodik.info/video/fallback', $result->title->kodik_link);
        $this->assertTrue($result->title->is_published);
    }
}
