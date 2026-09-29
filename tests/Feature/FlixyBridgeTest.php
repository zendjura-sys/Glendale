<?php

namespace Tests\Feature;

use App\Cinema\CinemaSettings;
use App\Cinema\Genre;
use App\Cinema\Title;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Міст для CineCon (переробленого Flixy) — ті самі шляхи й форма відповіді,
 * що очікує нативний застосунок (RetrofitService), але дані з нашого
 * власного каталогу кінопорталу. Див. App\Http\Controllers\Api\FlixyBridgeController.
 */
class FlixyBridgeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        CinemaSettings::setSecret(CinemaSettings::FLIXY_API_KEY, 'flixy-test-key');
    }

    private function headers(): array
    {
        return ['apikey' => CinemaSettings::flixyApiKey()];
    }

    public function test_requests_without_valid_apikey_are_rejected(): void
    {
        $this->postJson('/api/flixy/fetchSettings')->assertStatus(401);
        $this->postJson('/api/flixy/fetchSettings', [], ['apikey' => 'wrong'])->assertStatus(401);
        $this->postJson('/api/flixy/fetchSettings', [], $this->headers())->assertOk()->assertJsonPath('status', true);
    }

    public function test_fetch_settings_returns_genres(): void
    {
        Genre::create(['name' => 'Бойовик', 'slug' => 'action']);

        $this->postJson('/api/flixy/fetchSettings', [], $this->headers())
            ->assertOk()
            ->assertJsonPath('status', true)
            ->assertJsonPath('setting.app_name', 'CineCon')
            ->assertJsonPath('genres.0.title', 'Бойовик');
    }

    public function test_fetch_home_page_data_returns_featured_and_genre_rows(): void
    {
        $genre = Genre::create(['name' => 'Фантастика', 'slug' => 'scifi']);
        $movie = Title::create(['tmdb_id' => 1, 'type' => 'movie', 'name' => 'Матриця', 'is_featured' => true]);
        $movie->genres()->attach($genre->id);
        Title::create(['tmdb_id' => 2, 'type' => 'movie', 'name' => 'Неопублікований', 'is_published' => false]);

        $res = $this->postJson('/api/flixy/fetchHomePageData', ['user_id' => 1], $this->headers())->assertOk();
        $res->assertJsonPath('status', true)->assertJsonPath('featured.0.title', 'Матриця');
        $this->assertSame(1, count($res->json('genreContents')));
        $this->assertSame('Матриця', $res->json('genreContents.0.contents.0.title'));

        // Без user_id — валідаційна помилка, як в оригіналі Flixy.
        $this->postJson('/api/flixy/fetchHomePageData', [], $this->headers())
            ->assertOk()->assertJsonPath('status', false);
    }

    public function test_fetch_contents_by_genre_and_search(): void
    {
        $genre = Genre::create(['name' => 'Драма', 'slug' => 'drama']);
        $title = Title::create(['tmdb_id' => 3, 'type' => 'series', 'name' => 'Гра престолів']);
        $title->genres()->attach($genre->id);

        $this->postJson('/api/flixy/fetchContentsByGenre', ['genre_id' => $genre->id, 'start' => 0, 'limit' => 10], $this->headers())
            ->assertOk()->assertJsonPath('data.0.title', 'Гра престолів')->assertJsonPath('data.0.type', 2);

        $this->postJson('/api/flixy/searchContent', ['start' => 0, 'limit' => 10, 'keyword' => 'престолів'], $this->headers())
            ->assertOk()->assertJsonCount(1, 'data');

        $this->postJson('/api/flixy/searchContent', ['start' => 0, 'limit' => 10, 'keyword' => 'немає такого'], $this->headers())
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_fetch_content_details_includes_seasons_for_series(): void
    {
        $title = Title::create(['tmdb_id' => 4, 'type' => 'series', 'name' => 'Дорама']);
        $season = $title->seasons()->create(['number' => 1]);
        $season->episodes()->create(['title_id' => $title->id, 'number' => 1, 'name' => 'Перша серія']);

        $res = $this->postJson('/api/flixy/fetchContentDetails', ['content_id' => $title->id], $this->headers())->assertOk();
        $res->assertJsonPath('status', true)->assertJsonPath('data.title', 'Дорама');
        $this->assertSame(1, count($res->json('data.seasons.0.episode')));
        $this->assertSame('Перша серія', $res->json('data.seasons.0.episode.0.title'));
        // Немає прямого потоку від Kodik/FlixCDN (iframe, не m3u8/mp4) — свідомо порожньо.
        $this->assertSame([], $res->json('data.content_sources'));

        $this->postJson('/api/flixy/fetchContentDetails', ['content_id' => 999999], $this->headers())
            ->assertOk()->assertJsonPath('status', false);
    }
}
