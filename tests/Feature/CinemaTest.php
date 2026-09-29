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
            'kodik-api.com/search*' => fn ($request) => Http::response(['results' => str_contains($request->url(), 'imdb_id=tt0944947')
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

    /**
     * TMDB часто не має назви обкраїнською для нішевих азійських тайтлів —
     * тоді основне поле збігається з оригінальною назвою. Маємо пробувати
     * довідник перекладів TMDB: спершу uk, потім ru, а не показувати
     * ієрогліфи, коли переклад насправді є, просто не в основному полі.
     */
    public function test_import_falls_back_to_tmdb_translations_when_no_ukrainian_title(): void
    {
        Http::fake([
            'api.themoviedb.org/3/movie/9100*' => Http::response([
                'id' => 9100, 'title' => '愛·回家之開心速遞', 'original_title' => '愛·回家之開心速遞',
                'original_language' => 'zh', 'release_date' => '2017-01-01',
                'translations' => ['translations' => [
                    ['iso_639_1' => 'en', 'data' => ['title' => 'Come Home Love: Lo and Behold']],
                    ['iso_639_1' => 'ru', 'data' => ['title' => 'Скандал']],
                ]],
            ]),
        ]);

        $title = Importer::import('movie', 9100);

        $this->assertSame('Скандал', $title->name);
        $this->assertSame('愛·回家之開心速遞', $title->original_name, 'оригінальну назву не чіпаємо');
    }

    /** Коли TMDB уже дав назву мовою сайту — довідник перекладів навіть не питаємо. */
    public function test_import_keeps_tmdb_localized_title_as_is(): void
    {
        $title = Importer::import('movie', 603);
        $this->assertSame('Матриця', $title->name);
    }

    /**
     * Основна назва — лише одна мова (українська чи яка є), але шукати
     * тайтл можна й іншою: обидва варіанти (укр+рос) зберігаються поряд,
     * а не лише той, що переміг у localizedName().
     */
    public function test_alt_names_allow_searching_in_another_language(): void
    {
        Http::fake([
            'api.themoviedb.org/3/movie/9200*' => Http::response([
                'id' => 9200, 'title' => '愛情', 'original_title' => '愛情',
                'original_language' => 'zh', 'release_date' => '2020-01-01', 'genres' => [],
                'translations' => ['translations' => [
                    ['iso_639_1' => 'uk', 'data' => ['title' => 'Кохання']],
                    ['iso_639_1' => 'ru', 'data' => ['title' => 'Любовь']],
                    ['iso_639_1' => 'en', 'data' => ['title' => 'Love']],
                ]],
            ]),
        ]);

        $title = Importer::import('movie', 9200);
        $this->assertSame('Кохання', $title->name, 'основна — перша знайдена (укр)');
        $this->assertSame(['Любовь', 'Love'], $title->alt_names, 'решта мов — окремо, для пошуку');

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v2/cinema/titles?q=Любовь')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('items.0.id', $title->id);
        $this->getJson('/api/v2/cinema/titles?q=Love')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('items.0.id', $title->id);
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
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=0")->assertOk()
            ->assertJsonPath('link', 'https://kodik.info/video/1/bbb/720p')
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

    /** imdb_id/mdl_id/worldart_link — теж редаговані в адмінці й теж у пріоритетному ланцюжку Kodik::search. */
    public function test_admin_sets_mdl_and_worldart_ids_and_kodik_uses_them_in_priority_order(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        $title = Importer::import('movie', 603, attachPlayers: false);

        $this->patch("/admin/cinema/titles/{$title->id}", [
            'imdb_id' => 'tt0133093',
            'mdl_id' => 5525,
            'worldart_link' => 'http://www.world-art.ru/animation/animation.php?id=123',
        ])->assertRedirect()->assertSessionHasNoErrors();
        $title->refresh();
        $this->assertSame('tt0133093', $title->imdb_id);
        $this->assertSame(5525, $title->mdl_id);
        $this->assertSame('http://www.world-art.ru/animation/animation.php?id=123', $title->worldart_link);

        // Немає shikimori_id — Kodik іде одразу до imdb_id (наступного в ланцюжку).
        $this->post("/admin/cinema/titles/{$title->id}/kodik")->assertRedirect();
        Http::assertSent(fn ($request) => str_contains((string) $request->url(), 'imdb_id=tt0133093'));

        // Текстові поля теж мають коректно очищуватись до null.
        $this->patch("/admin/cinema/titles/{$title->id}", ['worldart_link' => null])->assertRedirect();
        $this->assertNull($title->fresh()->worldart_link);
    }

    /** Без shikimori_id/imdb_id Kodik::search пробує mdl_id — наступний за пріоритетом. */
    public function test_kodik_search_uses_mdl_id_when_no_shikimori_or_imdb(): void
    {
        $title = Title::create([
            'tmdb_id' => 9020, 'type' => 'movie', 'name' => 'Дорама без Shikimori/IMDb',
            'mdl_id' => 5525, 'worldart_link' => 'http://www.world-art.ru/animation/animation.php?id=123',
        ]);

        \App\Cinema\Kodik::search($title);

        Http::assertSent(fn ($request) => str_contains((string) $request->url(), 'mdl_id=5525'));
    }

    /**
     * Аніме, яке відновилось через роки після оригінального релізу (як
     * Bleach: Thousand-Year Blood War), у Kodik нерідко проіндексоване під
     * іншим роком — пошук «назва+рік» дає нуль, хоча плеєр насправді є.
     * Запасний запит без року має його знайти.
     */
    public function test_kodik_falls_back_to_title_without_year(): void
    {
        $title = Title::create(['tmdb_id' => 9030, 'type' => 'series', 'name' => 'Bleach', 'year' => 2022]);
        Http::fake([
            'kodik-api.com/search*' => fn ($request) => str_contains((string) $request->url(), 'year=2022')
                ? Http::response(['results' => []])
                : Http::response(['results' => [
                    ['type' => 'anime-serial', 'link' => '//kodik.info/serial/1/bleach/720p', 'translation' => ['id' => 1, 'title' => 'Аніма']],
                ]]),
        ]);

        $results = \App\Cinema\Kodik::search($title);

        $this->assertNotEmpty($results, 'запасний запит без року мав знайти плеєр');
        Http::assertSent(fn ($request) => str_contains((string) $request->url(), 'title=Bleach') && ! str_contains((string) $request->url(), 'year='));
    }

    /**
     * TMDB може повернути оригінальну назву ієрогліфами, тоді як Kodik
     * зберігає той самий тайтл під англійською або російською назвою.
     * Усі вже збережені alt_names мають брати участь у пошуку плеєра.
     */
    public function test_kodik_searches_all_alternative_names(): void
    {
        $title = Title::create([
            'tmdb_id' => 9032,
            'type' => 'series',
            'name' => 'Ван Піс',
            'original_name' => 'ワンピース',
            'alt_names' => ['One Piece', 'Ван-Пис'],
            'year' => 1999,
        ]);
        // setUp already registers a broad Kodik fallback. Replace the HTTP
        // factory so this regression controls the response for each title.
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::preventStrayRequests();
        Http::fake([
            'kodik-api.com/search*' => function ($request) {
                parse_str((string) parse_url((string) $request->url(), PHP_URL_QUERY), $query);

                return ($query['title'] ?? null) === 'One Piece'
                    ? Http::response(['results' => [[
                        'type' => 'anime-serial',
                        'link' => '//kodik.info/serial/1/one-piece/720p',
                        'translation' => ['id' => 1, 'title' => 'Дубляж'],
                    ]]])
                    : Http::response(['results' => []]);
            },
        ]);

        $this->assertTrue(\App\Cinema\Kodik::attach($title));
        $this->assertSame('https://kodik.info/serial/1/one-piece/720p', $title->fresh()->kodik_link);
        Http::assertSent(function ($request) {
            parse_str((string) parse_url((string) $request->url(), PHP_URL_QUERY), $query);

            return ($query['title'] ?? null) === 'One Piece';
        });
    }

    /** Тип не збігся в жодному запиті — краще плеєр із сумнівним типом, ніж жодного. */
    public function test_kodik_returns_type_mismatched_result_as_last_resort(): void
    {
        $title = Title::create(['tmdb_id' => 9031, 'type' => 'series', 'name' => 'Гранична сутичка', 'year' => 2024]);
        Http::fake([
            'kodik-api.com/search*' => Http::response(['results' => [
                ['type' => 'foreign-movie', 'link' => '//kodik.info/video/1/edge/720p', 'translation' => ['id' => 1, 'title' => 'Дубляж']],
            ]]),
        ]);

        $results = \App\Cinema\Kodik::search($title);

        $this->assertNotEmpty($results, 'без запасного варіанту тайтл лишився б зовсім без плеєра');
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

    /**
     * Локальний каталог порожній за пошуковим запитом — має самостійно
     * піти в TMDB, підвантажити перший збіг (разом із плеєром) і одразу
     * віддати його в тій самій відповіді, без «нічого не знайдено».
     */
    public function test_browse_search_falls_back_to_tmdb_and_imports_the_match(): void
    {
        Http::fake([
            'api.themoviedb.org/3/search/multi*' => Http::response(['results' => [
                ['id' => 603, 'media_type' => 'movie', 'title' => 'Матриця', 'release_date' => '1999-03-30'],
            ]]),
        ]);
        Sanctum::actingAs(User::factory()->create());

        $res = $this->getJson('/api/v2/cinema/titles?q=Матриця')->assertOk();

        $this->assertSame(1, $res->json('total'));
        $this->assertSame('Матриця', $res->json('items.0.name'));
        $title = Title::query()->where('tmdb_id', 603)->where('type', 'movie')->firstOrFail();
        $this->assertNotNull($title->kodik_link, 'плеєр мав підтягнутись у той самий момент');
    }

    /** Пошук без збігів ні локально, ні в TMDB — звичайне «нічого не знайдено», без падіння. */
    public function test_browse_search_with_no_tmdb_match_stays_empty(): void
    {
        Http::fake([
            'api.themoviedb.org/3/search/multi*' => Http::response(['results' => []]),
        ]);
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v2/cinema/titles?q=Щосьнеіснуюче')->assertOk()->assertJsonPath('total', 0)->assertJsonPath('items', []);
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

        // Kodik + FlixCDN — по одній кнопці на джерело (озвучки перемикає сам плеєр), один список.
        $this->assertSame('https://player.uacdn.live/embed/matrix', $title->flixcdn_link);
        $this->assertCount(2, $title->flixcdn_translations);

        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $full = $this->getJson("/api/v2/cinema/titles/{$title->id}")->assertOk()->json();
        $this->assertCount(2, $full['translations']);
        $this->assertSame('kodik', $full['translations'][0]['source']);
        $this->assertSame('Kodik', $full['translations'][0]['title']);
        $this->assertSame('flixcdn', $full['translations'][1]['source']);
        $this->assertSame('FlixCDN', $full['translations'][1]['title']);

        // Індекс 1 (FlixCDN) у плеєрі веде саме на flixcdn_link.
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=1")->assertOk()
            ->assertJsonPath('link', 'https://player.uacdn.live/embed/matrix');

        // Якщо в Kodik немає нічого — FlixCDN сам по собі вже дає hasPlayer.
        $title->update(['kodik_link' => null, 'kodik_translations' => null]);
        $this->getJson('/api/v2/cinema/home')->assertOk()->assertJsonPath('movies.0.hasPlayer', true);
    }

    /**
     * Кнопка Kodik — завжди в списку джерел, навіть коли плеєра ще не
     * знайдено: людина бачить джерело, просто неактивне, а не думає, що
     * Kodik узагалі не пробували. FlixCDN (коли є) лишається робочим.
     */
    public function test_kodik_tab_always_present_but_marked_unavailable_without_a_link(): void
    {
        CinemaSettings::setSecret(CinemaSettings::FLIXCDN_TOKEN, 'test-flixcdn');
        Http::fake(['api0.uacdn.live/api/search*' => Http::response(['result' => [
            ['iframe_url' => '//player.uacdn.live/embed/matrix', 'title_rus' => 'Матриця', 'type' => 'movie', 'poster' => 'https://img.uacdn.live/matrix.jpg'],
        ]])]);
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, null);

        $title = Importer::import('movie', 603);
        $this->assertNull($title->kodik_link);
        $this->assertSame('https://player.uacdn.live/embed/matrix', $title->flixcdn_link);

        Sanctum::actingAs(User::factory()->create());
        $full = $this->getJson("/api/v2/cinema/titles/{$title->id}")->assertOk()->json();
        $this->assertCount(2, $full['translations']);
        $this->assertSame('kodik', $full['translations'][0]['source']);
        $this->assertFalse($full['translations'][0]['available']);
        $this->assertTrue($full['translations'][1]['available']);

        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=0")->assertNotFound();
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=1")->assertOk()
            ->assertJsonPath('link', 'https://player.uacdn.live/embed/matrix');

        // Жодного плеєра взагалі — Kodik лишається єдиним пунктом, просто неактивним.
        $title->update(['flixcdn_link' => null, 'flixcdn_translations' => null]);
        $solo = $this->getJson("/api/v2/cinema/titles/{$title->id}")->assertOk()->json();
        $this->assertCount(1, $solo['translations']);
        $this->assertSame('kodik', $solo['translations'][0]['source']);
        $this->assertFalse($solo['translations'][0]['available']);
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

    /** Кнопка «Проставити Kodik/FlixCDN на всі» — окрема черга для кожного джерела, лише де його бракує. */
    public function test_admin_bulk_attaches_players_per_source(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin);
        \Illuminate\Support\Facades\Queue::fake();

        $needsBoth = Title::create(['tmdb_id' => 9010, 'type' => 'movie', 'name' => 'Без плеєра']);
        $needsKodikOnly = Title::create(['tmdb_id' => 9011, 'type' => 'movie', 'name' => 'Вже є FlixCDN', 'flixcdn_link' => 'https://player.uacdn.live/embed/x']);
        $hasKodik = Title::create(['tmdb_id' => 9012, 'type' => 'movie', 'name' => 'Вже є Kodik', 'kodik_link' => 'https://kodik.info/x']);
        \App\Cinema\KodikSource::create([
            'title_id' => $hasKodik->id, 'kodik_id' => 'existing', 'translation_id' => '1',
            'link' => 'https://kodik.info/x', 'is_available' => true,
        ]);

        $this->post('/admin/cinema/bulk-attach-players', ['source' => 'kodik'])->assertRedirect()->assertSessionHasNoErrors();

        \Illuminate\Support\Facades\Queue::assertPushed(\App\Cinema\RebindKodikTitleJob::class, 2);
        \Illuminate\Support\Facades\Queue::assertPushed(fn (\App\Cinema\RebindKodikTitleJob $j) => $j->titleId === $needsBoth->id);
        \Illuminate\Support\Facades\Queue::assertPushed(fn (\App\Cinema\RebindKodikTitleJob $j) => $j->titleId === $needsKodikOnly->id);
        \Illuminate\Support\Facades\Queue::assertNotPushed(fn (\App\Cinema\RebindKodikTitleJob $j) => $j->titleId === $hasKodik->id);

        // FlixCDN не налаштовано в цьому тесті — кнопка має відмовити з поясненням.
        $this->post('/admin/cinema/bulk-attach-players', ['source' => 'flixcdn'])->assertRedirect()->assertSessionHasErrors('bulk');
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

    /** Фоновий TMDB-імпорт не запускає застарілу точкову прив'язку Kodik: каталог Kodik синхронізується окремим scheduler. */
    public function test_auto_import_job_leaves_kodik_to_catalog_synchronizer(): void
    {
        (new \App\Cinema\ImportTitleJob('movie', 603))->handle();

        Http::assertNotSent(fn ($request) => str_contains((string) $request->url(), 'kodik-api.com'));
        $this->assertNull(Title::query()->where('tmdb_id', 603)->firstOrFail()->kodik_link);
    }

    /** Технічна помилка Kodik не ставить добовий cooldown для тайтла без плеєра. */
    public function test_auto_import_retries_kodik_after_technical_error_without_daily_block(): void
    {
        $this->travelTo(\Illuminate\Support\Carbon::createFromTimestamp(0));
        \Illuminate\Support\Facades\Queue::fake();
        Http::fake([
            'api.themoviedb.org/3/trending/all/week*' => Http::response(['results' => []]),
            'kodik-api.com/search*' => Http::response(['results' => [[
                'type' => 'foreign-movie', 'link' => '//kodik.info/video/retry/720p',
                'translation' => ['id' => 77, 'title' => 'Українська'],
            ]]]),
        ]);
        $title = Title::create([
            'tmdb_id' => 9004, 'type' => 'movie', 'name' => 'Повтор',
            'flixcdn_link' => 'https://player.uacdn.live/embed/retry',
            'kodik_sync_status' => 'failed', 'kodik_last_error' => 'server',
            'kodik_checked_at' => null,
        ]);

        $this->artisan('cinema:auto-import')->assertSuccessful();

        $title->refresh();
        $this->assertNotNull($title->kodik_link);
        $this->assertSame('attached', $title->kodik_sync_status);
        $this->assertNotNull($title->kodik_checked_at);
        $this->travelBack();
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

    /**
     * Раніше повторний пошук плеєра вимагав відсутності ОБОХ посилань —
     * тайтл з уже знайденим FlixCDN назавжди лишався без спроб Kodik.
     * Тепер має пробувати те джерело, якого справді бракує.
     */
    public function test_auto_import_retries_missing_source_even_when_the_other_already_found(): void
    {
        $this->travelTo(\Illuminate\Support\Carbon::createFromTimestamp(0));
        CinemaSettings::setSecret(CinemaSettings::FLIXCDN_TOKEN, 'test-flixcdn');
        \Illuminate\Support\Facades\Queue::fake();
        Http::fake([
            'api.themoviedb.org/3/trending/all/week*' => Http::response(['results' => []]),
        ]);
        $title = Title::create([
            'tmdb_id' => 9003, 'type' => 'movie', 'name' => 'Бліч',
            'flixcdn_link' => 'https://player.uacdn.live/embed/bleach', 'flixcdn_checked_at' => now(),
        ]);

        $this->artisan('cinema:auto-import')->assertSuccessful();

        $this->assertNotNull($title->fresh()->kodik_link);
        $this->travelBack();
    }

    /**
     * Серіал, що ще триває, раз на добу перечитується з TMDB заново — інакше
     * нові сезони й серії просто не з'являлись би в каталозі, доки хтось
     * вручну не перезапустить імпорт.
     */
    public function test_auto_import_refreshes_ongoing_series_but_not_finished_ones(): void
    {
        $this->travelTo(\Illuminate\Support\Carbon::createFromTimestamp(0));
        \Illuminate\Support\Facades\Queue::fake();
        Http::fake([
            'api.themoviedb.org/3/trending/all/week*' => Http::response(['results' => []]),
        ]);

        $ongoing = Title::create(['tmdb_id' => 1399, 'type' => 'series', 'name' => 'Стара назва', 'vote_average' => 1.0, 'status' => 'Returning Series']);
        $finished = Title::create(['tmdb_id' => 1400, 'type' => 'series', 'name' => 'Завершений серіал', 'vote_average' => 1.0, 'status' => 'Ended']);

        $this->artisan('cinema:auto-import')->assertSuccessful();

        // tv/1399 у фікстурі setUp() повертає vote_average 8.4 — оновлення точно відбулось, а не просто торкнуло timestamp.
        $this->assertSame(8.4, $ongoing->fresh()->vote_average);
        $this->assertNotNull($ongoing->fresh()->tmdb_synced_at);
        $this->assertSame(1.0, $finished->fresh()->vote_average, 'завершений серіал більше не чіпаємо');
        $this->assertNull($finished->fresh()->tmdb_synced_at);
        Http::assertNotSent(fn ($request) => str_contains((string) $request->url(), '/tv/1400'));
        $this->travelBack();
    }

    /** Чорний список і мінімальний рік обмежують лише автозаповнення — ручний імпорт за посиланням ними не керується. */
    public function test_auto_import_skips_blacklisted_and_too_old_titles(): void
    {
        $this->travelTo(\Illuminate\Support\Carbon::createFromTimestamp(0));
        \Illuminate\Support\Facades\Queue::fake();
        \App\Models\Setting::set(CinemaSettings::BLACKLIST, '950, 951', 'cinema');
        \App\Models\Setting::set(CinemaSettings::MIN_YEAR, '2020', 'cinema');
        Http::fake([
            'api.themoviedb.org/3/trending/all/week*' => Http::response(['results' => [
                ['id' => 950, 'media_type' => 'movie', 'title' => 'У чорному списку', 'release_date' => '2026-01-01'],
                ['id' => 952, 'media_type' => 'movie', 'title' => 'Застарий', 'release_date' => '2015-01-01'],
                ['id' => 953, 'media_type' => 'movie', 'title' => 'Норм', 'release_date' => '2026-01-01'],
            ]]),
        ]);

        $this->artisan('cinema:auto-import')->assertSuccessful();

        \Illuminate\Support\Facades\Queue::assertNotPushed(fn (\App\Cinema\ImportTitleJob $j) => $j->tmdbId === 950);
        \Illuminate\Support\Facades\Queue::assertNotPushed(fn (\App\Cinema\ImportTitleJob $j) => $j->tmdbId === 952);
        \Illuminate\Support\Facades\Queue::assertPushed(fn (\App\Cinema\ImportTitleJob $j) => $j->tmdbId === 953);
        $this->travelBack();
    }

    /**
     * Ручне керування сезонами/серіями — для ексклюзивних релізів, яких
     * немає на TMDB (звичайний імпорт їх не підхопить).
     */
    public function test_admin_manages_seasons_and_episodes_manually(): void
    {
        $this->actingAs($this->admin());
        $this->withoutVite();
        $title = Title::create(['tmdb_id' => 9040, 'type' => 'series', 'name' => 'Власний реліз']);

        $this->post("/admin/cinema/titles/{$title->id}/seasons", ['number' => 1, 'name' => 'Сезон 1'])
            ->assertRedirect()->assertSessionHasNoErrors();
        $season = $title->seasons()->firstOrFail();
        $this->assertSame(1, $season->number);

        // Той самий номер сезону вдруге — конфлікт.
        $this->post("/admin/cinema/titles/{$title->id}/seasons", ['number' => 1])->assertSessionHasErrors('number');

        $this->put("/admin/cinema/seasons/{$season->id}", ['name' => 'Перший сезон'])->assertRedirect();
        $this->assertSame('Перший сезон', $season->fresh()->name);

        $this->post("/admin/cinema/seasons/{$season->id}/episodes", [
            'number' => 1, 'name' => 'Пілот', 'air_date' => '2026-01-01', 'runtime' => 42,
        ])->assertRedirect()->assertSessionHasNoErrors();
        $episode = $season->episodes()->firstOrFail();
        $this->assertSame('Пілот', $episode->name);
        $this->assertSame(1, $season->fresh()->episodes_count);

        // Той самий номер серії в цьому сезоні вдруге — конфлікт.
        $this->post("/admin/cinema/seasons/{$season->id}/episodes", ['number' => 1])->assertSessionHasErrors('number');

        $this->put("/admin/cinema/episodes/{$episode->id}", ['name' => 'Перша серія'])->assertRedirect();
        $this->assertSame('Перша серія', $episode->fresh()->name);

        $this->getJson("/admin/cinema/titles/{$title->id}/seasons")->assertOk()
            ->assertJsonPath('0.number', 1)->assertJsonPath('0.episodes.0.name', 'Перша серія');

        $this->delete("/admin/cinema/episodes/{$episode->id}")->assertRedirect();
        $this->assertSame(0, $season->episodes()->count());

        $this->delete("/admin/cinema/seasons/{$season->id}")->assertRedirect();
        $this->assertSame(0, $title->seasons()->count());
    }

    public function test_admin_saves_blacklist_and_min_year(): void
    {
        $this->actingAs($this->admin());
        $this->withoutVite();

        $this->put('/admin/cinema/settings', ['blacklist' => "603\n1399", 'minYear' => 2015, 'language' => 'uk-UA'])->assertRedirect();

        $this->assertSame([603, 1399], CinemaSettings::blacklist());
        $this->assertSame(2015, CinemaSettings::minYear());
    }
}
