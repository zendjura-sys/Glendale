<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\Post;
use App\Models\User;
use App\Services\Cinema\CinemaAutoImport;
use App\Services\Cinema\CinemaService;
use App\Services\Cinema\FlixcdnClient;
use App\Support\Modules\ModuleManager;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CinemaTest extends TestCase
{
    use RefreshDatabase;

    private const KODIK_TOKEN = 'abcdef0123456789abcdef0123456789';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        config([
            'services.kodik.api_url' => 'https://kodik-api.com',
            'services.kodik.token' => null,
            'services.flixcdn.template' => null,
            'services.flixcdn.api_search' => null,
            'services.flixcdn.api_updates' => null,
            'services.tmdb.token' => null,
            'services.tmdb.api_url' => 'https://api.themoviedb.org/3',
            'services.omdb.key' => null,
            'services.shikimori.url' => 'https://shikimori.one',
        ]);
        app(SiteSettings::class)->put(['shikimori_enabled' => false]);
    }

    private function movie(array $attributes = []): Movie
    {
        $movie = Movie::query()->create([
            'slug' => 'matrix-1999-'.uniqid(),
            'type' => 'movie',
            'title' => 'Матриця',
            'title_original' => 'The Matrix',
            'year' => 1999,
            'genres' => ['фантастика', 'бойовик'],
            'rating_imdb' => 8.7,
            'imdb_id' => 'tt0133093',
            ...$attributes,
        ]);
        $movie->sources()->create(['provider' => 'custom', 'external_id' => 'yt', 'link' => 'https://www.youtube-nocookie.com/embed/abc', 'translation' => 'Оригінал']);

        return $movie;
    }

    /**
     * @return array<string, mixed>
     */
    private function kodikItem(string $id, string $translation, array $overrides = []): array
    {
        return [
            'id' => $id,
            'type' => 'foreign-movie',
            'link' => '//kodik.info/video/'.$id.'/hash/720p',
            'title' => 'Матрица',
            'title_orig' => 'The Matrix',
            'year' => 1999,
            'kinopoisk_id' => '301',
            'imdb_id' => 'tt0133093',
            'quality' => 'WEB-DLRip 720p',
            'translation' => ['id' => 1, 'title' => $translation, 'type' => 'voice'],
            'material_data' => [
                'title' => 'Матрица',
                'description' => 'Опис російською',
                'poster_url' => 'https://st.kp.yandex.net/images/film_big/301.jpg',
                'genres' => ['фантастика', 'боевик'],
                'imdb_rating' => 8.7,
                'kinopoisk_rating' => 8.5,
                'duration' => 136,
                'minimal_age' => 16,
            ],
            ...$overrides,
        ];
    }

    private function enableKodik(): void
    {
        app(SiteSettings::class)->putSecret('kodik_token', self::KODIK_TOKEN);
    }

    public function test_catalog_page_shows_featured_movies_and_hides_unpublished(): void
    {
        $user = User::factory()->create();
        $this->movie(['is_featured' => true, 'description' => 'Нео дізнається правду.']);
        $this->movie(['title' => 'Прихований', 'is_published' => false]);

        $this->actingAs($user)->get('/cinema')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('cinema/index')
                ->has('featured', 1)
                ->where('featured.0.title', 'Матриця')
                ->where('total', 1)
            );

        $this->actingAs($user)->get('/cinema?q=Прихов')
            ->assertInertia(fn (Assert $page) => $page->where('total', 0)->where('filtered', true));
    }

    public function test_cinema_module_can_be_disabled(): void
    {
        app(ModuleManager::class)->set('cinema', false);

        $this->actingAs(User::factory()->create())->get('/cinema')->assertNotFound();
    }

    public function test_movie_page_has_players_and_counts_a_view_once_per_session(): void
    {
        $user = User::factory()->create();
        $movie = $this->movie();

        $this->actingAs($user)->get('/cinema/'.$movie->slug)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('cinema/show')
                ->where('movie.title', 'Матриця')
                ->has('players', 1)
                ->where('players.0.provider', 'custom')
                ->where('state.status', null)
                ->missing('movie.ratings.kp')
            );
        $this->actingAs($user)->get('/cinema/'.$movie->slug)->assertOk();

        $this->assertSame(1, $movie->fresh()->views_count);

        $hidden = $this->movie(['is_published' => false]);
        $this->actingAs($user)->get('/cinema/'.$hidden->slug)->assertNotFound();
    }

    public function test_user_lists_ratings_and_autostart(): void
    {
        $user = User::factory()->create();
        $movie = $this->movie();

        $this->actingAs($user)->patchJson("/cinema/{$movie->slug}/status", ['status' => 'planned'])
            ->assertOk()->assertJsonPath('state.status', 'planned')->assertJsonPath('watchers_count', 1);
        $this->actingAs($user)->putJson("/cinema/{$movie->slug}/rating", ['rating' => 9])
            ->assertOk()->assertJsonPath('state.rating', 9)->assertJsonPath('user_rating', 9);
        $this->actingAs($user)->putJson("/cinema/{$movie->slug}/rating", ['rating' => 11])->assertUnprocessable();

        $this->actingAs($user)->get('/cinema/my?status=planned')
            ->assertInertia(fn (Assert $page) => $page->component('cinema/my')->where('counts.planned', 1)->where('counts.rated', 1));

        $this->actingAs($user)->patchJson("/cinema/{$movie->slug}/status", ['status' => null]);
        $this->actingAs($user)->putJson("/cinema/{$movie->slug}/rating", ['rating' => null])->assertJsonPath('watchers_count', 0);
        $this->assertDatabaseMissing('movie_user', ['user_id' => $user->id]);

        $this->actingAs($user)->postJson("/cinema/{$movie->slug}/started")->assertJsonPath('state.status', 'watching');
    }

    public function test_movie_comments_like_and_delete(): void
    {
        $author = User::factory()->create();
        $other = User::factory()->create();
        $movie = $this->movie();

        $id = $this->actingAs($author)->postJson("/cinema/{$movie->slug}/comments", ['body' => 'Шедевр'])
            ->assertCreated()->assertJsonPath('comments_count', 1)->json('comment.id');

        $this->actingAs($other)->postJson("/comments/{$id}/like")->assertOk()->assertJsonPath('liked', true);
        $this->actingAs($other)->deleteJson("/comments/{$id}")->assertForbidden();
        $this->actingAs($author)->deleteJson("/comments/{$id}")->assertOk()->assertJsonPath('comments_count', 0);

        $movie->update(['comments_enabled' => false]);
        $this->actingAs($author)->postJson("/cinema/{$movie->slug}/comments", ['body' => 'x'])->assertForbidden();
    }

    public function test_movie_can_be_shared_to_the_wall(): void
    {
        $user = User::factory()->create();
        $movie = $this->movie();

        $this->actingAs($user)->post('/posts', ['visibility' => 'public', 'movie_id' => $movie->id])->assertSessionHasNoErrors();

        $post = Post::query()->sole();
        $this->assertSame($movie->id, $post->movie_id);

        $this->actingAs($user)->get('/posts/'.$post->id)
            ->assertInertia(fn (Assert $page) => $page->where('post.movie.title', 'Матриця')->where('post.movie.available', true));

        $hidden = $this->movie(['is_published' => false]);
        $this->actingAs($user)->post('/posts', ['visibility' => 'public', 'movie_id' => $hidden->id])->assertSessionHasErrors('movie_id');
    }

    public function test_admin_imports_from_kodik_with_all_voiceovers_and_reimport_updates_sources(): void
    {
        $admin = User::factory()->admin()->create();
        $this->enableKodik();
        $results = [$this->kodikItem('movie-1', 'Дубляж'), $this->kodikItem('movie-2', 'LostFilm')];
        Http::fake(['kodik-api.com/search*' => function () use (&$results) {
            return Http::response(['results' => $results]);
        }]);

        $this->actingAs($admin)->getJson('/admin/cinema/remote/kodik/search?q=Матрица')
            ->assertOk()
            ->assertJsonPath('candidates.0.sources_count', 2)
            ->assertJsonPath('candidates.0.translations', ['Дубляж', 'LostFilm'])
            ->assertJsonMissingPath('candidates.0.kinopoisk_id')
            ->assertJsonMissingPath('candidates.0.rating_kp');

        $this->actingAs($admin)->postJson('/admin/cinema/remote/import', ['provider' => 'kodik', 'key' => 'kp:301'])
            ->assertOk()->assertJsonPath('sources', 2);

        $movie = Movie::query()->sole();
        $this->assertSame('kodik', $movie->origin);
        $this->assertSame('https://kodik.info/video/movie-1/hash/720p', $movie->sources->first()->link);
        $this->assertSame('16+', $movie->age_rating);

        // Провайдер перестав віддавати «Дубляж»: озвучка лишається, доки не зникне на RETIRE_DAYS днів.
        $results = [$this->kodikItem('movie-2', 'LostFilm')];
        $this->actingAs($admin)->post("/admin/cinema/{$movie->id}/refresh")->assertRedirect();
        $this->assertSame(['Дубляж', 'LostFilm'], $movie->sources()->orderBy('position')->pluck('translation')->all());
        $this->assertNotNull($movie->sources()->where('translation', 'Дубляж')->value('missing_since'));

        $this->travel(MovieSource::RETIRE_DAYS + 1)->days();
        $this->actingAs($admin)->post("/admin/cinema/{$movie->id}/refresh")->assertRedirect();
        $this->assertSame(['LostFilm'], $movie->sources()->pluck('translation')->all());
    }

    public function test_catalog_import_keeps_other_voices_and_custom_players(): void
    {
        $movie = Movie::query()->create(['slug' => 'matrix', 'type' => 'movie', 'title' => 'Матриця', 'kinopoisk_id' => '301', 'is_published' => true]);
        foreach ([['kodik', 'movie-1', 'Дубляж', 'https://kodik.info/video/movie-1/hash/720p'], ['kodik', 'movie-2', 'LostFilm', 'https://kodik.info/video/movie-2/hash/720p'], ['custom', 'own-1', 'Свій', 'https://example.com/embed/1']] as $i => [$provider, $id, $voice, $link]) {
            $source = new MovieSource(['provider' => $provider, 'external_id' => $id, 'translation' => $voice, 'link' => $link, 'position' => $i]);
            $source->movie()->associate($movie)->save();
        }
        $movie->sources()->where('external_id', 'movie-2')->update(['is_hidden' => true]);

        // Автозаповнення каталогу приносить лише одну озвучку цього тайтлу.
        app(CinemaService::class)->import([
            'type' => 'movie', 'title' => 'Матриця', 'kinopoisk_id' => '301',
            'sources' => [['external_id' => 'movie-3', 'translation' => 'AniDUB', 'link' => 'https://kodik.info/video/movie-3/hash/720p']],
        ], null, 'kodik', true, false);

        $this->assertSame(['Дубляж', 'LostFilm', 'Свій', 'AniDUB'], $movie->sources()->orderBy('position')->pluck('translation')->all());
        $this->assertTrue((bool) $movie->sources()->where('external_id', 'movie-2')->value('is_hidden'));
        $this->assertSame(0, $movie->sources()->whereNotNull('missing_since')->count());
    }

    public function test_kodik_token_error_is_reported_to_admin(): void
    {
        $admin = User::factory()->admin()->create();
        $this->enableKodik();
        Http::fake(['kodik-api.com/*' => Http::response(['error' => 'Отсутствует или неверный токен'], 500)]);

        $this->actingAs($admin)->getJson('/admin/cinema/remote/kodik/search?q=test')
            ->assertStatus(500)
            ->assertJsonPath('message', 'Kodik відхилив токен. Перевірте його в налаштуваннях інтеграції.');
    }

    public function test_auto_import_creates_titles_enriches_them_from_tmdb_and_skips_trashed(): void
    {
        $this->enableKodik();
        app(SiteSettings::class)->putSecret('tmdb_token', 'tmdbkey123');
        $trashed = Movie::query()->create(['slug' => 'old', 'type' => 'movie', 'title' => 'Видалений', 'imdb_id' => 'tt0000002']);
        $trashed->delete();

        Http::fake([
            'kodik-api.com/list*' => Http::sequence()
                ->push(['results' => [
                    $this->kodikItem('m1', 'Дубляж'),
                    $this->kodikItem('m2', 'Оригінал', ['kinopoisk_id' => null, 'imdb_id' => 'tt0000002', 'title' => 'Видалений']),
                    $this->kodikItem('m3', 'Без ID', ['kinopoisk_id' => null, 'imdb_id' => null, 'title' => 'Нонейм']),
                ], 'next_page' => 'https://kodik-api.com/list?token='.self::KODIK_TOKEN.'&next=2'])
                ->push(['results' => [$this->kodikItem('s1', 'AniLibria', ['type' => 'anime-serial', 'kinopoisk_id' => '555', 'imdb_id' => null, 'shikimori_id' => '1', 'title' => 'Ковбой Бібоп', 'episodes_count' => 26])]]),
            'api.themoviedb.org/3/find/*' => Http::response(['movie_results' => [['id' => 603]], 'tv_results' => []]),
            'api.themoviedb.org/3/movie/603*' => Http::response([
                'title' => 'Матриця',
                'original_title' => 'The Matrix',
                'overview' => 'Хакер Нео дізнається, що світ — симуляція.',
                'poster_path' => '/p.jpg',
                'backdrop_path' => '/b.jpg',
                'genres' => [['name' => 'Фантастика'], ['name' => 'Бойовик']],
                'runtime' => 136,
                'vote_average' => 8.2,
                'release_date' => '1999-03-30',
                'imdb_id' => 'tt0133093',
                'videos' => ['results' => [['site' => 'YouTube', 'type' => 'Trailer', 'key' => 'vKQi3bBA1y8', 'iso_639_1' => 'en']]],
            ]),
            'api.themoviedb.org/3/search/*' => Http::response(['results' => []]),
        ]);

        app(CinemaAutoImport::class)->save(['enabled' => true, 'pages' => 3]);
        $this->artisan('cinema:sync')->assertSuccessful();

        $stats = app(CinemaAutoImport::class)->lastRun();
        $this->assertSame(2, $stats['created']);
        $this->assertSame(2, $stats['skipped']);
        $this->assertSoftDeleted($trashed);

        $matrix = Movie::query()->where('imdb_id', 'tt0133093')->sole();
        $this->assertSame('Хакер Нео дізнається, що світ — симуляція.', $matrix->description);
        $this->assertSame(['фантастика', 'бойовик'], $matrix->genres);
        $this->assertSame('movie:603', $matrix->tmdb_id);
        $this->assertSame(8.2, $matrix->rating_tmdb);
        $this->assertSame('https://image.tmdb.org/t/p/w1280/b.jpg', $matrix->backdrop_url);
        $this->assertSame('https://www.youtube-nocookie.com/embed/vKQi3bBA1y8', $matrix->trailer_url);
        $this->assertNotNull($matrix->enriched_at);

        $anime = Movie::query()->where('shikimori_id', '1')->sole();
        $this->assertSame('anime', $anime->type);
        $this->assertSame(26, $anime->episodes_count);

        $this->artisan('cinema:sync')->expectsOutput('Автонаповнення вимкнено або ще не час.');
    }

    public function test_flixcdn_api_responses_are_parsed_flexibly(): void
    {
        app(SiteSettings::class)->put(['flixcdn_api_search' => 'https://api.flix.test/search?token={token}&imdb={imdb_id}&kp={kinopoisk_id}']);
        app(SiteSettings::class)->putSecret('flixcdn_token', 'flixtoken');
        Http::fake([
            'api.flix.test/*' => Http::response(['data' => [[
                'id' => 77, 'kp_id' => 301, 'imdb' => 'tt0133093', 'ru_title' => 'Матрица', 'orig_title' => 'The Matrix', 'year' => '1999',
                'iframe_src' => '//flixcdn.test/embed/77', 'type' => 'movie', 'translations' => [['title' => 'Дубляж'], ['title' => 'LostFilm']],
            ]]]),
        ]);

        $candidates = app(FlixcdnClient::class)->search(['imdb_id' => 'tt0133093']);

        $this->assertCount(1, $candidates);
        $this->assertSame('kp:301', $candidates[0]['key']);
        $this->assertSame('https://flixcdn.test/embed/77', $candidates[0]['sources'][0]['link']);
        $this->assertSame('Дубляж, LostFilm', $candidates[0]['sources'][0]['translation']);
        Http::assertSent(fn (Request $r) => $r->url() === 'https://api.flix.test/search?token=flixtoken&imdb=tt0133093');

        $movie = app(CinemaService::class)->import($candidates[0], null, 'flixcdn');
        $this->assertSame('flixcdn', $movie->sources()->value('provider'));
    }

    public function test_flixcdn_template_player_is_offered_when_no_api_sources(): void
    {
        $user = User::factory()->create();
        app(SiteSettings::class)->put(['flixcdn_template' => 'https://player.flix.test/?imdb={imdb_id}&t={token}']);
        app(SiteSettings::class)->putSecret('flixcdn_token', 'tok');
        $movie = $this->movie();

        $this->actingAs($user)->get('/cinema/'.$movie->slug)
            ->assertInertia(fn (Assert $page) => $page->has('players', 2)->where('players.1.provider', 'custom')->where('players.0.link', 'https://player.flix.test/?imdb=tt0133093&t=tok'));
    }

    public function test_admin_configures_integrations_without_exposing_secrets(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->put('/admin/integrations/cinema/kodik', ['token' => 'bad token'])->assertSessionHasErrors('token');
        $this->actingAs($admin)->put('/admin/integrations/cinema/kodik', ['token' => self::KODIK_TOKEN])->assertSessionHasNoErrors();
        $this->actingAs($admin)->put('/admin/integrations/cinema/tmdb', ['token' => 'eyJhbGciOiJIUzI1NiJ9.payload.sig', 'language' => 'uk-UA'])->assertSessionHasNoErrors();
        $this->actingAs($admin)->put('/admin/integrations/cinema/flixcdn', ['template' => 'https://player.test/?q=1'])->assertSessionHasErrors('template');
        $this->actingAs($admin)->put('/admin/integrations/cinema/kinopoisk', ['key' => 'x'])->assertNotFound();

        $settings = app(SiteSettings::class);
        $this->assertSame(self::KODIK_TOKEN, $settings->secret('kodik_token'));
        $this->assertNotSame(self::KODIK_TOKEN, $settings->get('kodik_token'));

        $response = $this->actingAs($admin)->get('/admin/integrations')->assertOk();
        $this->assertStringNotContainsString(self::KODIK_TOKEN, $response->getContent());
        $this->assertStringNotContainsString('КіноПошук', $response->getContent());
        $response->assertInertia(fn (Assert $page) => $page
            ->component('admin/integrations')
            ->has('cinema', 19)
            ->where('cinema.2.key', 'push')
            ->where('cinema.3.key', 'telegram_bot')
            ->where('cinema.4.key', 'discord_bot')
            ->where('cinema.5.key', 'twitch')
            ->where('cinema.6.key', 'sightengine')
            ->where('cinema.7.key', 'voice')
            ->where('cinema.8.key', 'igdb')
            ->where('cinema.9.key', 'rawg')
            ->where('cinema.10.key', 'kodik')
            ->where('cinema.10.configured', true));

        Http::fake(['kodik-api.com/*' => Http::response(['results' => []])]);
        $this->actingAs($admin)->post('/admin/integrations/cinema/kodik/test')->assertRedirect();
    }

    public function test_admin_manages_catalog_and_auto_import_settings(): void
    {
        $admin = User::factory()->admin()->create();
        $member = User::factory()->create();
        $this->actingAs($member)->get('/admin/cinema')->assertForbidden();

        $this->actingAs($admin)->post('/admin/cinema', ['title' => 'Мій фільм', 'type' => 'movie', 'year' => 2024, 'genres' => ['драма'], 'trailer_url' => 'https://youtu.be/aqz-KE-bpKQ'])
            ->assertRedirect();
        $movie = Movie::query()->sole();
        $this->assertSame('manual', $movie->origin);
        $this->assertSame('https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', $movie->trailer_url);

        $this->actingAs($admin)->post("/admin/cinema/{$movie->id}/sources", ['link' => 'https://www.youtube.com/watch?v=eRsGyueVLvQ', 'translation' => 'Оригінал'])->assertSessionHasNoErrors();
        $this->assertSame('https://www.youtube-nocookie.com/embed/eRsGyueVLvQ', $movie->sources()->value('link'));

        $this->actingAs($admin)->get('/admin/cinema')->assertInertia(fn (Assert $page) => $page
            ->component('admin/cinema')
            ->where('stats.movies', 1)
            ->where('auto.config.enabled', false));

        $this->actingAs($admin)->put('/admin/cinema/auto', [
            'enabled' => true, 'providers' => ['kodik'], 'kodik_types' => ['anime-serial'], 'pages' => 3, 'interval' => 180,
            'publish' => false, 'enrich' => true, 'enrich_limit' => 20, 'min_year' => 2000, 'only_with_ids' => true,
        ])->assertSessionHasNoErrors();
        $this->assertSame(180, app(CinemaAutoImport::class)->config()['interval']);

        $this->actingAs($admin)->delete("/admin/cinema/{$movie->id}");
        $this->assertSoftDeleted($movie);
        $this->actingAs($admin)->delete("/admin/cinema/{$movie->id}");
        $this->assertDatabaseMissing('movies', ['id' => $movie->id]);
    }

    public function test_player_embed_allows_kodik_and_rejects_other_hosts(): void
    {
        $this->get('/play/embed?src='.urlencode('https://kodik.info/video/1/hash/720p'))
            ->assertOk()
            ->assertSee('https://kodik.info/video/1/hash/720p', false)
            ->assertSee('referrerpolicy="origin"', false);

        $this->get('/play/embed?src='.urlencode('https://evil.example/phish'))->assertNotFound();
        $this->get('/play/embed?src='.urlencode('http://kodik.info/video/1'))->assertNotFound();
    }
}
