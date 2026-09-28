<?php

namespace Tests\Feature;

use App\Cinema\CinemaSettings;
use App\Cinema\Importer;
use App\Cinema\Title;
use App\Models\User;
use Database\Seeders\SystemPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Кінопортал як частина ядра: імпорт із TMDB, плеєр Kodik, оцінки — і
 * зв'язок із соцмережею та родинами (записи в стрічці, поради друзям,
 * стіна родини, кіновечір у календарі родини).
 */
class CinemaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        CinemaSettings::setSecret(CinemaSettings::TMDB_KEY, 'test-v3-key');
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-kodik');
        Http::preventStrayRequests();
        Http::fake([
            'api.themoviedb.org/3/movie/603*' => Http::response([
                'id' => 603, 'title' => 'Матриця', 'original_title' => 'The Matrix', 'release_date' => '1999-03-30',
                'runtime' => 136, 'overview' => 'Хакер Нео дізнається правду.', 'poster_path' => '/p.jpg', 'backdrop_path' => '/b.jpg',
                'vote_average' => 8.2, 'vote_count' => 25000, 'popularity' => 90, 'imdb_id' => 'tt0133093',
                'genres' => [['id' => 28, 'name' => 'бойовик'], ['id' => 878, 'name' => 'фантастика']],
                'production_countries' => [['name' => 'США']],
                'credits' => [
                    'cast' => [['id' => 6384, 'name' => 'Кіану Рівз', 'character' => 'Нео', 'profile_path' => '/k.jpg']],
                    'crew' => [['id' => 9340, 'name' => 'Лана Вачовскі', 'job' => 'Director']],
                ],
                'videos' => ['results' => [['site' => 'YouTube', 'key' => 'vKQi3bBA1y8', 'type' => 'Trailer', 'iso_639_1' => 'uk', 'name' => 'Трейлер']]],
            ]),
            'api.themoviedb.org/3/tv/1399/season/1*' => Http::response(['episodes' => [
                ['episode_number' => 1, 'name' => 'Зима близько', 'air_date' => '2011-04-17'],
                ['episode_number' => 2, 'name' => 'Королівський тракт'],
            ]]),
            'api.themoviedb.org/3/tv/1399*' => Http::response([
                'id' => 1399, 'name' => 'Гра престолів', 'original_name' => 'Game of Thrones', 'first_air_date' => '2011-04-17',
                'number_of_seasons' => 8, 'number_of_episodes' => 73, 'vote_average' => 8.4, 'vote_count' => 22000,
                'genres' => [['id' => 18, 'name' => 'драма']], 'external_ids' => ['imdb_id' => 'tt0944947'],
                'seasons' => [['season_number' => 0, 'name' => 'Спецвипуски'], ['season_number' => 1, 'name' => 'Сезон 1', 'episode_count' => 10]],
                'created_by' => [['id' => 9813, 'name' => 'Девід Беніофф']],
            ]),
            'api.themoviedb.org/3/movie/popular*' => Http::response(['results' => [
                ['id' => 603, 'title' => 'Матриця', 'release_date' => '1999-03-30'],
                ['id' => 604, 'title' => 'Матриця: Перезавантаження', 'release_date' => '2003-05-15'],
            ]]),
            'kodikapi.com/search*' => fn ($request) => Http::response(['results' => str_contains($request->url(), 'imdb_id=tt0944947')
                ? [['type' => 'foreign-serial', 'link' => '//kodik.info/serial/1/abc/720p', 'translation' => ['id' => 1, 'title' => 'LostFilm'], 'last_season' => 8]]
                : [
                    ['type' => 'foreign-movie', 'link' => '//kodik.info/video/1/aaa/720p', 'translation' => ['id' => 2, 'title' => 'Дубляж'], 'quality' => 'BDRip 720p'],
                    ['type' => 'foreign-movie', 'link' => '//kodik.info/video/1/bbb/720p', 'translation' => ['id' => 3, 'title' => 'Українська (ТакТребаПродакшн)'], 'quality' => 'BDRip 720p'],
                ]]),
        ]);
    }

    private function admin(): User
    {
        $this->seed(SystemPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    private function family(string $name): int
    {
        return DB::table('families')->insertGetId([
            'name' => $name, 'tag' => mb_strtoupper(mb_substr($name, 0, 3)), 'project' => 'Verba Online', 'server' => '1',
            'description' => '', 'status' => 'verified', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function member(int $familyId, string $role = 'member', ?User $user = null): User
    {
        $user ??= User::factory()->create();
        DB::table('family_members')->insert(['family_id' => $familyId, 'user_id' => $user->id, 'role' => $role, 'created_at' => now()]);

        return $user;
    }

    public function test_keys_are_stored_encrypted(): void
    {
        $raw = DB::table('settings')->where('key', CinemaSettings::KODIK_TOKEN)->value('value');
        $this->assertNotSame('test-kodik', $raw);
        $this->assertStringNotContainsString('test-kodik', (string) $raw);
        $this->assertSame('test-kodik', CinemaSettings::kodikToken());
    }

    public function test_import_movie_with_cast_trailer_and_ukrainian_dub_first(): void
    {
        $title = Importer::import('movie', 603);

        $this->assertSame('Матриця', $title->name);
        $this->assertSame(1999, $title->year);
        $this->assertSame('vKQi3bBA1y8', $title->trailer_key);
        $this->assertSame(['Бойовик', 'Фантастика'], $title->genres->pluck('name')->sort()->values()->all());
        $this->assertSame(2, $title->credits()->count());
        // Українська озвучка — першою, посилання — з https.
        $this->assertSame('https://kodik.info/video/1/bbb/720p', $title->kodik_link);
        $this->assertStringContainsString('Українська', $title->kodik_translations[0]['title']);

        // Повторний імпорт оновлює, а не дублює.
        Importer::import('movie', 603);
        $this->assertSame(1, Title::query()->count());
    }

    public function test_series_seasons_and_episodes_load_lazily(): void
    {
        $title = Importer::import('series', 1399);
        $this->assertSame('series', $title->type);
        $this->assertSame([1], $title->seasons()->pluck('number')->all(), 'спецвипуски пропущено');
        $this->assertSame('https://kodik.info/serial/1/abc/720p', $title->kodik_link);

        Sanctum::actingAs(User::factory()->create());
        $this->getJson("/api/v2/cinema/titles/{$title->id}/seasons/1")->assertOk()
            ->assertJsonCount(2)->assertJsonPath('0.name', 'Зима близько');
    }

    public function test_home_show_player_and_progress(): void
    {
        $title = Importer::import('movie', 603);
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->getJson('/api/v2/cinema/home')->assertOk()->assertJsonPath('movies.0.name', 'Матриця');
        $this->getJson("/api/v2/cinema/titles/{$title->id}")->assertOk()
            ->assertJsonPath('trailer', 'vKQi3bBA1y8')
            ->assertJsonPath('cast.0.role', 'Нео')
            ->assertJsonPath('translations.0.index', 0);

        $this->postJson("/api/v2/cinema/titles/{$title->id}/progress", ['position' => 600, 'duration' => 8160])->assertOk();
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=1")->assertOk()
            ->assertJsonPath('link', 'https://kodik.info/video/1/aaa/720p')
            ->assertJsonPath('progress.position', 600);
        $this->getJson('/api/v2/cinema/home')->assertJsonPath('continue.0.id', $title->id);

        // Знятий з публікації фільм звичайному глядачеві не видно.
        $title->update(['is_published' => false]);
        $this->getJson("/api/v2/cinema/titles/{$title->id}")->assertNotFound();
    }

    public function test_review_shares_to_feed_and_friends_see_ratings(): void
    {
        $title = Importer::import('movie', 603);
        $me = User::factory()->create();
        $friend = User::factory()->create();
        DB::table('social_friends')->insert([['user_id' => $me->id, 'friend_id' => $friend->id, 'created_at' => now()], ['user_id' => $friend->id, 'friend_id' => $me->id, 'created_at' => now()]]);

        Sanctum::actingAs($me);
        $this->putJson("/api/v2/cinema/titles/{$title->id}/review", ['rating' => 9, 'body' => 'Класика.', 'share' => true])->assertOk()
            ->assertJsonPath('myReview.rating', 9)->assertJsonPath('localRating', 9);

        // Запис у стрічці друга — з карткою фільму.
        Sanctum::actingAs($friend);
        $this->getJson('/api/v2/feed')->assertOk()->assertJsonPath('items.0.cinema.name', 'Матриця');
        // На сторінці фільму друг бачить мою оцінку.
        $this->getJson("/api/v2/cinema/titles/{$title->id}")->assertJsonPath('social.ratings.0.rating', 9)
            ->assertJsonPath('social.ratings.0.user.id', $me->id);
        // А в профілі — розділ «Кіно».
        $this->getJson("/api/v2/cinema/users/{$me->id}")->assertOk()->assertJsonPath('ratings.0.myRating', 9);
    }

    public function test_recommend_only_to_friends_or_family(): void
    {
        $title = Importer::import('movie', 603);
        $fam = $this->family('Monsory');
        $me = $this->member($fam);
        $relative = $this->member($fam);
        $stranger = User::factory()->create();

        Sanctum::actingAs($me);
        $this->postJson("/api/v2/cinema/titles/{$title->id}/recommend", ['userIds' => [$relative->id, $stranger->id]])
            ->assertOk()->assertJsonPath('sent', 1);
        $this->assertDatabaseHas('social_notifications', ['user_id' => $relative->id, 'type' => 'cinema_recommend', 'cinema_title_id' => $title->id]);
        $this->assertDatabaseMissing('social_notifications', ['user_id' => $stranger->id]);

        Sanctum::actingAs($relative);
        $this->getJson('/api/v2/notifications')->assertOk()->assertJsonPath('items.0.titleId', $title->id);
    }

    public function test_family_wall_is_members_only_and_can_carry_a_movie(): void
    {
        $title = Importer::import('movie', 603);
        $fam = $this->family('Monsory');
        $member = $this->member($fam);
        $outsider = User::factory()->create();

        Sanctum::actingAs($member);
        $post = $this->postJson('/api/v2/posts', ['ownerType' => 'family', 'ownerId' => $fam, 'text' => 'Кіновечір у п\'ятницю', 'cinemaTitleId' => $title->id])
            ->assertCreated()->assertJsonPath('family.id', $fam)->assertJsonPath('cinema.id', $title->id)->json();
        $this->getJson("/api/v2/wall/family/{$fam}")->assertOk()->assertJsonPath('items.0.id', $post['id']);
        $this->getJson('/api/v2/feed')->assertJsonPath('items.0.id', $post['id']);

        Sanctum::actingAs($outsider);
        $this->getJson("/api/v2/wall/family/{$fam}")->assertForbidden();
        $this->getJson("/api/v2/posts/{$post['id']}")->assertForbidden();
        $this->postJson('/api/v2/posts', ['ownerType' => 'family', 'ownerId' => $fam, 'text' => 'чужий'])->assertForbidden();
        $this->getJson('/api/v2/feed?tab=popular')->assertOk()->assertJsonMissing(['id' => $post['id'], 'text' => 'Кіновечір у п\'ятницю']);
    }

    public function test_family_movie_night_is_for_managers(): void
    {
        if (! class_exists(\Addons\FamilyEvents\Models\FamilyEvent::class)) {
            $this->markTestSkipped('Модуль подій родини відсутній');
        }
        $title = Importer::import('movie', 603);
        $fam = $this->family('Monsory');
        $leader = $this->member($fam, 'leader');
        $member = $this->member($fam);
        $when = now()->addDays(2)->toIso8601String();

        Sanctum::actingAs($member);
        $this->postJson("/api/v2/cinema/titles/{$title->id}/family-event", ['familyId' => $fam, 'startsAt' => $when])->assertForbidden();

        Sanctum::actingAs($leader);
        $this->postJson("/api/v2/cinema/titles/{$title->id}/family-event", ['familyId' => $fam, 'startsAt' => $when, 'note' => 'Беріть попкорн'])->assertCreated();
        $this->assertDatabaseHas('family_events', ['family_id' => $fam, 'title' => 'Кіновечір: Матриця']);
    }

    public function test_search_finds_titles_and_families(): void
    {
        Importer::import('movie', 603);
        $this->family('Матрикс');
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v2/search?q='.urlencode('Матри'))->assertOk()
            ->assertJsonPath('titles.0.name', 'Матриця')
            ->assertJsonPath('families.0.name', 'Матрикс');
    }

    public function test_admin_manages_keys_imports_and_catalog(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);

        $this->withoutVite();
        $this->get('/admin/cinema')->assertOk();
        // Порожнє поле ключа — ключ не змінюється; значення не віддається у форму.
        $this->put('/admin/cinema/settings', ['tmdbKey' => '', 'kodikToken' => 'new-token', 'language' => 'uk-UA'])->assertRedirect();
        $this->assertSame('test-v3-key', CinemaSettings::tmdbKey());
        $this->assertSame('new-token', CinemaSettings::kodikToken());

        $this->post('/admin/cinema/import', ['reference' => 'https://www.themoviedb.org/movie/603-the-matrix'])->assertRedirect()->assertSessionHasNoErrors();
        $title = Title::query()->firstOrFail();

        $this->getJson('/admin/cinema/tmdb?list=popular_movies')->assertOk()
            ->assertJsonPath('0.imported', true)->assertJsonPath('1.imported', false);

        $this->patch("/admin/cinema/titles/{$title->id}", ['featured' => true, 'published' => false])->assertRedirect();
        $this->assertTrue($title->fresh()->is_featured);
        $this->assertFalse($title->fresh()->is_published);

        $this->delete("/admin/cinema/titles/{$title->id}")->assertRedirect();
        $this->assertSame(0, Title::query()->count());
    }

    /**
     * tmdb_id/shikimori_id — приховані поля лише для адмінки: керують
     * тим, за яким id Kodik шукає плеєр (shikimori_id — пріоритетний,
     * найточніший збіг для аніме й дорам).
     */
    public function test_admin_sets_shikimori_id_and_kodik_searches_by_it_first(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $title = Importer::import('movie', 603, attachPlayers: false);

        $this->patch("/admin/cinema/titles/{$title->id}", ['tmdb_id' => 603, 'shikimori_id' => 12345])->assertRedirect()->assertSessionHasNoErrors();
        $title->refresh();
        $this->assertSame(12345, $title->shikimori_id);

        $this->post("/admin/cinema/titles/{$title->id}/kodik")->assertRedirect();
        Http::assertSent(fn ($request) => str_contains((string) $request->url(), 'shikimori_id=12345'));

        // Очищення (null) теж має проходити — не губиться в array_filter.
        $this->patch("/admin/cinema/titles/{$title->id}", ['shikimori_id' => null])->assertRedirect();
        $this->assertNull($title->fresh()->shikimori_id);
    }

    public function test_regular_user_cannot_open_cinema_admin(): void
    {
        $this->seed(SystemPermissionsSeeder::class);
        $this->actingAs(User::factory()->create());
        $this->get('/admin/cinema')->assertForbidden();
    }

    public function test_categories_badges_trending_and_history(): void
    {
        $this->assertSame('anime', Title::categorize('series', [16, 18], 'ja'));
        $this->assertSame('cartoon', Title::categorize('movie', [16], 'en'));
        $this->assertSame('toon', Title::categorize('series', [16], 'en'));
        $this->assertSame('dorama', Title::categorize('series', [18], 'ko'));
        $this->assertSame('movie', Title::categorize('movie', [28], 'en'));

        $matrix = Importer::import('movie', 603);
        $got = Importer::import('series', 1399);
        $this->assertSame('movie', $matrix->category);
        $this->assertSame('series', $got->category);

        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->postJson("/api/v2/cinema/titles/{$got->id}/progress", ['position' => 900, 'season' => 1, 'episode' => 2])->assertOk();

        $home = $this->getJson('/api/v2/cinema/home')->assertOk();
        $this->assertSame($got->id, $home->json('trending.0.id'), 'що дивились — у трендах першим');
        $this->assertSame(['movie', 'series', 'anime', 'dorama', 'cartoon', 'toon'], array_column($home->json('categories'), 'key'));
        $this->assertSame(1, $home->json('categories.0.count'));
        $this->assertContains('DUB', $home->json('movies.0.badges'));

        $this->getJson('/api/v2/cinema/titles?category=series')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('items.0.id', $got->id);
        $this->getJson('/api/v2/cinema/history')->assertOk()->assertJsonPath('0.id', $got->id)->assertJsonPath('0.progress.episode', 2);
    }

    /** FlixCDN — другий балансер, працює паралельно з Kodik: обидва в одному списку джерел. */
    public function test_flixcdn_works_alongside_kodik(): void
    {
        CinemaSettings::setSecret(CinemaSettings::FLIXCDN_TOKEN, 'test-flixcdn');
        Http::fake([
            'api0.uacdn.live/api/search*' => fn ($request) => Http::response(['result' => [
                [
                    'imdb_id' => 'tt0133093', 'iframe_url' => '//player.uacdn.live/embed/matrix',
                    'title_rus' => 'Матриця', 'title_orig' => 'The Matrix', 'type' => 'movie',
                    'translations' => [['title' => 'Дубляж Струдель'], ['title' => 'Багатоголосий']],
                    'poster' => 'https://img.uacdn.live/matrix.jpg',
                ],
            ]]),
        ]);

        $title = Importer::import('movie', 603);

        // Kodik (2 озвучки) + FlixCDN (1 пункт, обидва разом) — один список.
        $this->assertSame('https://player.uacdn.live/embed/matrix', $title->flixcdn_link);
        $this->assertCount(2, $title->flixcdn_translations);

        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $full = $this->getJson("/api/v2/cinema/titles/{$title->id}")->assertOk()->json();
        $this->assertCount(3, $full['translations']);
        $this->assertSame('kodik', $full['translations'][0]['source']);
        $this->assertSame('flixcdn', $full['translations'][2]['source']);
        $this->assertStringContainsString('FlixCDN', $full['translations'][2]['title']);

        // Індекс 2 (FlixCDN) у плеєрі веде саме на flixcdn_link.
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=2")->assertOk()
            ->assertJsonPath('link', 'https://player.uacdn.live/embed/matrix');

        // Якщо в Kodik немає нічого — FlixCDN сам по собі вже дає hasPlayer.
        $title->update(['kodik_link' => null, 'kodik_translations' => null]);
        $this->getJson('/api/v2/cinema/home')->assertOk()->assertJsonPath('movies.0.hasPlayer', true);
    }

    /** Постер FlixCDN — запасне джерело, коли TMDB свого не дав. */
    public function test_flixcdn_poster_fills_in_when_tmdb_has_none(): void
    {
        CinemaSettings::setSecret(CinemaSettings::FLIXCDN_TOKEN, 'test-flixcdn');
        Http::fake([
            'api.themoviedb.org/3/movie/604*' => Http::response([
                'id' => 604, 'title' => 'Матриця: Перезавантаження', 'release_date' => '2003-05-15',
                'poster_path' => null, 'genres' => [],
            ]),
            'api0.uacdn.live/api/search*' => Http::response(['result' => [
                ['iframe_url' => '', 'title_rus' => 'Матриця: Перезавантаження', 'type' => 'movie', 'poster' => 'https://img.uacdn.live/reloaded.jpg'],
            ]]),
        ]);

        $title = Importer::import('movie', 604);

        $this->assertSame('https://img.uacdn.live/reloaded.jpg', $title->poster_path);
    }

    public function test_admin_manages_flixcdn_token_and_manual_attach(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $title = Importer::import('movie', 603, attachPlayers: false);
        $this->assertNull($title->flixcdn_link);

        $this->put('/admin/cinema/settings', ['flixcdnToken' => 'new-flixcdn-token', 'language' => 'uk-UA'])->assertRedirect();
        $this->assertSame('new-flixcdn-token', CinemaSettings::flixcdnToken());

        Http::fake([
            'api0.uacdn.live/api/search*' => Http::response(['result' => [
                ['iframe_url' => '//player.uacdn.live/embed/matrix', 'title_rus' => 'Матриця', 'type' => 'movie', 'translations' => []],
            ]]),
        ]);
        $this->post("/admin/cinema/titles/{$title->id}/flixcdn")->assertRedirect()->assertSessionHasNoErrors();
        $this->assertSame('https://player.uacdn.live/embed/matrix', $title->fresh()->flixcdn_link);
    }

    public function test_browse_covers_anime_dorama_and_cartoons_via_discover(): void
    {
        Http::fake([
            'api.themoviedb.org/3/discover/tv*' => fn ($request) => Http::response(['results' => [
                str_contains((string) $request->url(), 'with_original_language=ja')
                    ? ['id' => 900, 'name' => 'Атака титанів', 'first_air_date' => '2013-04-07']
                    : ['id' => 901, 'name' => 'Гра в кальмара', 'first_air_date' => '2021-09-17'],
            ]]),
            'api.themoviedb.org/3/discover/movie*' => Http::response(['results' => [
                ['id' => 902, 'title' => 'Історія іграшок', 'release_date' => '1995-11-22'],
            ]]),
        ]);

        $anime = Importer::browse('anime', 1);
        $this->assertSame('series', $anime[0]['type']);
        $this->assertSame(900, $anime[0]['tmdbId']);

        $dorama = Importer::browse('dorama', 1);
        $this->assertSame('series', $dorama[0]['type']);
        $this->assertSame(901, $dorama[0]['tmdbId']);

        $cartoons = Importer::browse('cartoons', 1);
        $this->assertSame('movie', $cartoons[0]['type']);
        $this->assertSame(902, $cartoons[0]['tmdbId']);
    }

    /**
     * Аніме й дорами — пріоритет Kodik: якщо він уже знайшов озвучку,
     * FlixCDN того дня взагалі не чіпаємо (немає фейку на uacdn.live —
     * preventStrayRequests() зробить помилку, якби виклик усе ж стався).
     */
    public function test_kodik_priority_for_anime_skips_flixcdn_when_found(): void
    {
        CinemaSettings::setSecret(CinemaSettings::FLIXCDN_TOKEN, 'test-flixcdn');
        $title = Title::create(['tmdb_id' => 9001, 'type' => 'movie', 'category' => 'anime', 'name' => 'Тестове аніме']);

        \App\Cinema\PlayerSources::autoAttach($title);

        $title->refresh();
        $this->assertNotNull($title->kodik_link);
        $this->assertNull($title->flixcdn_link);
        $this->assertNull($title->flixcdn_checked_at);
    }

    /** Для фільмів/серіалів (не аніме/дорама) FlixCDN усе одно перевіряється, навіть якщо Kodik уже знайшов. */
    public function test_flixcdn_still_checked_for_movies_even_when_kodik_found(): void
    {
        CinemaSettings::setSecret(CinemaSettings::FLIXCDN_TOKEN, 'test-flixcdn');
        Http::fake(['api0.uacdn.live/api/search*' => Http::response(['result' => []])]);
        $title = Title::create(['tmdb_id' => 9002, 'type' => 'movie', 'category' => 'movie', 'name' => 'Тестовий фільм']);

        \App\Cinema\PlayerSources::autoAttach($title);

        $title->refresh();
        $this->assertNotNull($title->kodik_link);
        $this->assertNotNull($title->flixcdn_checked_at);
    }

    public function test_auto_import_command_queues_from_rotating_list_and_retries_players(): void
    {
        // Тік = timestamp/3600 обирає список і сторінку — фіксуємо час на
        // epoch, де tick=0 гарантовано дає перший список («trending»),
        // інакше тест був би недетермінованим залежно від реального часу.
        $this->travelTo(\Illuminate\Support\Carbon::createFromTimestamp(0));
        \Illuminate\Support\Facades\Queue::fake();
        Http::fake([
            'api.themoviedb.org/3/trending/all/week*' => Http::response(['results' => [
                ['id' => 950, 'media_type' => 'movie', 'title' => 'Новинка', 'release_date' => '2026-01-01'],
            ]]),
        ]);

        $this->artisan('cinema:auto-import')->assertSuccessful();
        \Illuminate\Support\Facades\Queue::assertPushed(\App\Cinema\ImportTitleJob::class);
        $this->travelBack();
    }
}
