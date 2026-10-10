<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\User;
use App\Services\Cinema\CinemaAutoImport;
use App\Services\Cinema\CinemaPlayers;
use App\Services\Cinema\CinemaService;
use App\Services\Cinema\TmdbAutoParse;
use App\Services\Cinema\VideoseedClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class VideoseedPlayersTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'abcdef0123456789abcdef0123456789';

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        app(SiteSettings::class)->putSecret('videoseed_token', self::TOKEN);
    }

    /**
     * @return array<string, mixed>
     */
    private function item(array $overrides = []): array
    {
        return [
            'name' => 'Секс у великому місті',
            'original_name' => 'Sex and the City',
            'year' => '1998',
            'id' => '636',
            'id_kp' => '77042',
            'id_imdb' => 'tt0159206',
            'id_tmdb' => '105',
            'poster' => 'https://api.videoseed.tv/contents/dvds/groups/636/c1_1.jpg',
            'description' => 'Чотири подруги в Нью-Йорку.',
            'genre' => 'Сериалы, комедія',
            'country' => 'США',
            'type' => 'serial',
            'iframe' => 'https://tv-1-kinoserial.net/embed_serial/636/?token=t',
            'total_videos' => 94,
            'translation_iframe' => [
                'Професійний (LostFilm)' => ['translations_id' => 10, 'name' => 'Професійний (LostFilm)', 'iframe' => 'https://tv-1-kinoserial.net/embed_serial/636/?token=t&default_audio_id=10'],
                '[EN] Original' => ['translations_id' => '381', 'name' => '[EN] Original', 'iframe' => 'https://tv-1-kinoserial.net/embed_serial/636/?token=t&default_audio_id=381'],
                'Українська (Рекламна)' => ['translations_id' => 7, 'name' => 'Українська (Рекламна)', 'iframe' => 'https://tv-1-kinoserial.net/embed_serial/636/?token=t&default_audio_id=7'],
            ],
            ...$overrides,
        ];
    }

    public function test_auto_import_takes_videoseed_updates_with_every_voice(): void
    {
        Http::fake(['api.videoseed.tv/*' => Http::response(['status' => 'success', 'data' => [$this->item()], 'next_page' => null])]);
        $auto = app(CinemaAutoImport::class);
        $auto->save(['enabled' => true, 'providers' => ['videoseed'], 'videoseed_lists' => ['serial'], 'enrich' => false, 'pages' => 1]);

        $stats = $auto->run('test');

        $this->assertSame(1, $stats['providers']['videoseed']['created']);
        $movie = Movie::query()->firstOrFail();
        $this->assertSame('serial', $movie->type);
        $this->assertSame('tv:105', $movie->tmdb_id);
        $this->assertSame('77042', $movie->kinopoisk_id);
        $this->assertSame(3, $movie->sources()->where('provider', 'videoseed')->count());
        Http::assertSent(fn (HttpRequest $r) => $r['list'] === 'serial' && $r['token'] === self::TOKEN);
    }

    public function test_player_rules_order_hide_and_rename(): void
    {
        $movie = app(CinemaService::class)->import(VideoseedClient::candidate($this->item()), null, 'videoseed');
        $movie->sources()->create(['provider' => 'kodik', 'external_id' => 'k1', 'translation' => 'Дубляж', 'link' => 'https://kodik.info/v/1', 'position' => 0]);
        $admin = User::factory()->admin()->create();

        // За замовчуванням Kodik першим.
        $players = app(CinemaService::class)->players($movie->fresh('sources'));
        $this->assertSame('kodik', $players[0]['provider']);

        $this->actingAs($admin)->put('/admin/cinema/players', [
            'order' => ['videoseed', 'kodik', 'flixcdn', 'custom'],
            'disabled' => [],
            'labels' => ['videoseed' => 'Плеєр 2'],
            'voice_prefer' => ['[EN]'],
            'voice_block' => ['Рекламн'],
        ])->assertSessionHasNoErrors();

        $players = app(CinemaService::class)->players($movie->fresh('sources'));
        $this->assertSame('videoseed', $players[0]['provider']);
        $this->assertSame('Плеєр 2', $players[0]['provider_label']);
        $this->assertSame('[EN] Original', $players[0]['translation']);
        $this->assertCount(3, $players); // рекламну озвучку сховано
        $this->assertNotContains('Українська (Рекламна)', array_column($players, 'translation'));

        // Окрема озвучка: сховати в редакторі фільму.
        $source = MovieSource::query()->where('provider', 'kodik')->firstOrFail();
        $this->actingAs($admin)->patch("/admin/cinema/{$movie->id}/sources/{$source->id}", ['is_hidden' => true])->assertRedirect();
        $this->assertNotContains('kodik', array_column(app(CinemaService::class)->players($movie->fresh('sources')), 'provider'));

        // Вимкнений провайдер не показується зовсім.
        $this->actingAs($admin)->put('/admin/cinema/players', [
            'order' => ['videoseed', 'kodik', 'flixcdn', 'custom'],
            'disabled' => ['videoseed'],
        ])->assertSessionHasNoErrors();
        $this->assertSame([], app(CinemaService::class)->players($movie->fresh('sources')));
    }

    public function test_tmdb_discover_adds_titles_only_with_a_player(): void
    {
        app(SiteSettings::class)->putSecret('tmdb_token', 'eyJhbGciOiJIUzI1NiJ9.payload.sig');
        Http::fake([
            'api.themoviedb.org/3/trending/*' => Http::response(['results' => [
                ['id' => 105, 'media_type' => 'tv', 'name' => 'Секс і місто', 'first_air_date' => '1998-06-06', 'vote_count' => 900],
                ['id' => 999, 'media_type' => 'movie', 'title' => 'Без плеєра', 'release_date' => '2024-01-01', 'vote_count' => 900],
                ['id' => 5, 'media_type' => 'movie', 'title' => 'Мало голосів', 'release_date' => '2024-01-01', 'vote_count' => 3],
            ]]),
            'api.themoviedb.org/3/tv/105*' => Http::response(['id' => 105, 'name' => 'Секс і місто', 'original_name' => 'Sex and the City', 'overview' => 'Опис з TMDB', 'vote_average' => 7.3]),
            'api.themoviedb.org/*' => Http::response([], 404),
            'api.videoseed.tv/*' => function (HttpRequest $request) {
                return Http::response($request['tmdb'] === '105'
                    ? ['status' => 'success', 'data' => $this->item()]
                    : ['status' => 'success', 'data' => []]);
            },
        ]);

        $tmdb = app(TmdbAutoParse::class);
        $tmdb->save(['discover' => true, 'lists' => ['trending_week'], 'min_votes' => 50, 'fields' => ['description']]);
        $auto = app(CinemaAutoImport::class);
        $auto->save(['enabled' => true, 'providers' => [], 'enrich' => false]);

        $stats = $auto->run('test');

        $this->assertSame(1, $stats['providers']['tmdb']['created']);
        $movie = Movie::query()->sole();
        $this->assertSame('tv:105', $movie->tmdb_id);
        $this->assertSame('Опис з TMDB', $movie->description);
        // Назву TMDB не чіпав — поле вимкнене в налаштуваннях.
        $this->assertSame('Секс у великому місті', $movie->title);
        $this->assertSame(3, $movie->sources()->count());
    }

    public function test_admin_saves_tmdb_settings_and_sees_panels(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->put('/admin/cinema/tmdb', [
            'enabled' => true, 'fields' => ['description', 'poster_url'], 'mode' => 'fill', 'refresh_days' => 30,
            'discover' => true, 'lists' => ['popular_movie'], 'pages' => 2, 'discover_limit' => 10, 'min_votes' => 100,
            'min_year' => 2010, 'publish' => false, 'language' => 'en-US',
        ])->assertSessionHasNoErrors();

        $this->assertSame('fill', app(TmdbAutoParse::class)->config()['mode']);
        $this->assertSame('en-US', app(SiteSettings::class)->get('tmdb_language'));

        $this->actingAs($admin)->get('/admin/cinema')->assertInertia(fn (Assert $page) => $page
            ->where('tmdb.config.refresh_days', 30)
            ->where('tmdb.language', 'en-US')
            ->has('players.providers', 4)
            ->where('players.providers.1.key', 'videoseed')
            ->where('players.providers.1.configured', true));
    }

    public function test_episode_mode_lists_seasons_on_the_movie_page(): void
    {
        $item = $this->item(['seasons' => [
            '1' => ['videos' => ['1' => [], '2' => [], '3' => []]],
            '2' => ['videos' => ['1' => [], '2' => []]],
        ]]);
        Http::fake(['api.videoseed.tv/*' => Http::response(['status' => 'success', 'data' => $item])]);
        $movie = app(CinemaService::class)->import(VideoseedClient::candidate($item), null, 'videoseed');
        $movie->update(['is_published' => true]);
        $viewer = User::factory()->create();

        $this->actingAs($viewer)->get('/cinema/'.$movie->slug)->assertInertia(fn (Assert $page) => $page->where('episodes', null));

        app(CinemaPlayers::class)->save(['episodes' => true]);
        $this->actingAs($viewer)->get('/cinema/'.$movie->slug)->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->has('episodes', 2)
                ->where('episodes.0.number', 1)
                ->where('episodes.0.episodes', [1, 2, 3])
                ->where('episodes.1.episodes', [1, 2])));
    }
}
