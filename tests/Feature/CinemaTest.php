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
}
