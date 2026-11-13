<?php

namespace Tests\Feature;

use App\Http\Middleware\CanonicalUrl;
use App\Models\Clan;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\User;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Сторінки ігор і профілі відкриті гостям і пошуковикам: назва, опис, розмітка, карта сайту. */
class PublicPagesTest extends TestCase
{
    use RefreshDatabase;

    private const COVER = 'https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg';

    private function game(array $attributes = []): Game
    {
        // Палітра вже порахована — без звернень до IGDB.
        Cache::put('poster.palette.'.md5(self::COVER), ['base' => '#101820', 'accent' => '#ff5500', 'soft' => '#ffd0b0'], now()->addDay());

        return Game::query()->create([
            'slug' => 'apex', 'name' => 'Apex Legends', 'letter' => 'A', 'category' => 'pc', 'is_published' => true,
            'cover' => self::COVER, 'platforms' => ['pc'], 'genres' => ['Шутер'],
            'details' => ['summary' => 'Командна королівська битва героїв.'],
            ...$attributes,
        ]);
    }

    public function test_guest_sees_game_catalog_and_game_page_with_seo(): void
    {
        Http::preventStrayRequests();
        $this->game();

        $this->get('/games')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('games/index'))
            ->assertSee('<title>Каталог ігор', false);

        $html = $this->get('/games/apex')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('games/show')->where('game.name', 'Apex Legends'))
            ->getContent();

        $this->assertStringContainsString('<title>Apex Legends', $html);
        $this->assertStringContainsString('content="Командна королівська битва героїв."', $html);
        $this->assertStringContainsString('<meta property="og:image" content="'.self::COVER.'">', $html);
        $this->assertStringContainsString('"@type":"VideoGame"', $html);
        $this->assertStringContainsString('<link rel="canonical" href="'.url('/games/apex').'">', $html);
    }

    public function test_guest_cannot_act_on_game_and_hidden_games_stay_hidden(): void
    {
        Http::preventStrayRequests();
        $this->game();
        $this->game(['slug' => 'draft', 'name' => 'Draft', 'is_published' => false]);

        $this->post('/games/apex/wish')->assertRedirect('/login');
        $this->post('/games/apex/rating', ['score' => 8])->assertRedirect('/login');
        $this->get('/games/deals')->assertRedirect('/login');
        $this->get('/games/draft')->assertNotFound();
    }

    public function test_game_pages_close_with_games_module(): void
    {
        $this->game();
        app(ModuleManager::class)->set('games', false);

        $this->get('/games/apex')->assertNotFound();
        $this->assertStringNotContainsString('/games/apex', $this->get('/sitemaps/games.xml')->getContent());
    }

    public function test_sitemap_lists_published_games(): void
    {
        $this->game();
        $this->game(['slug' => 'draft', 'name' => 'Draft', 'is_published' => false]);

        $xml = $this->get('/sitemaps/games.xml')->assertOk()->getContent();

        $this->assertStringContainsString('<loc>'.url('/games').'</loc>', $xml);
        $this->assertStringContainsString('<loc>'.url('/games/apex').'</loc>', $xml);
        $this->assertStringNotContainsString('/games/draft', $xml);
    }

    public function test_profile_has_own_title_and_hides_about_when_private(): void
    {
        User::factory()->create(['first_name' => 'Олена', 'last_name' => 'Коваль', 'username' => 'olena', 'about' => 'Граю в Apex вечорами.']);
        User::factory()->create(['first_name' => 'Ігор', 'last_name' => 'Тихий', 'username' => 'igor', 'about' => 'Секрет', 'is_private' => true]);

        $html = $this->get('/olena')->assertOk()->getContent();
        $this->assertStringContainsString('<title>Олена Коваль (@olena)', $html);
        $this->assertStringContainsString('content="Граю в Apex вечорами."', $html);
        $this->assertStringContainsString('"@type":"ProfilePage"', $html);

        $html = $this->get('/igor')->assertOk()->getContent();
        $this->assertStringContainsString('<title>Ігор Тихий (@igor)', $html);
        $this->assertStringNotContainsString('Секрет', $html);
    }

    public function test_guest_sees_movie_server_and_clan_cards_with_schema(): void
    {
        $owner = User::factory()->create();
        Movie::query()->create(['slug' => 'matrix', 'type' => 'movie', 'title' => 'Матриця', 'year' => 1999, 'description' => 'Нео дізнається правду.', 'is_published' => true, 'rating_imdb' => 8.7]);
        Movie::query()->create(['slug' => 'draft', 'type' => 'movie', 'title' => 'Чернетка', 'is_published' => false]);
        GtaServer::query()->create(['slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp', 'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed', 'description' => 'Сервер для своїх.']);
        $clan = Clan::query()->create(['game_id' => $this->game()->id, 'slug' => 'navi', 'type' => 'clan', 'name' => 'NaVi', 'tag' => 'NAVI', 'owner_id' => $owner->id, 'features' => ['events'], 'join_mode' => 'open']);
        $clan->forceFill(['members_count' => 5])->save();

        $html = $this->get('/cinema/matrix')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('public/entity')->where('entity.kind', 'movie')->where('entity.title', 'Матриця'))
            ->getContent();
        $this->assertStringContainsString('"@type":"Movie"', $html);
        $this->assertStringContainsString('<title>Матриця (1999)', $html);
        $this->get('/cinema/draft')->assertNotFound();

        $this->assertStringContainsString('"@type":"GameServer"', $this->get('/servers/quant-rp')->assertOk()->getContent());
        $this->assertStringContainsString('"@type":"Organization","@id":"'.url('/clans/navi').'#clan"', $this->get('/clans/navi')->assertOk()->getContent());

        // Учасник бачить звичайні сторінки за тими самими адресами.
        $this->actingAs($owner)->get('/clans/navi')->assertOk()->assertInertia(fn (Assert $page) => $page->component('clans/show'));
        $this->actingAs($owner)->get('/servers/quant-rp')->assertOk()->assertInertia(fn (Assert $page) => $page->component('servers/show'));

        // Карта сайту: окремі частини для серверів і кланів; кіно в публічній карті немає.
        auth()->logout();
        $this->get('/sitemaps/cinema.xml')->assertNotFound();
        $this->assertStringContainsString('<loc>'.url('/servers/quant-rp').'</loc>', $this->get('/sitemaps/servers.xml')->getContent());
        $this->assertStringContainsString('<loc>'.url('/clans/navi').'</loc>', $this->get('/sitemaps/clans.xml')->getContent());
        $this->assertStringContainsString('"@type":"MobileApplication"', $this->get('/app')->assertOk()->getContent());
    }

    public function test_canonical_redirects_for_trailing_slash_and_username_case(): void
    {
        User::factory()->create(['username' => 'olena']);

        // Тестовий клієнт обрізає «/» в кінці адреси — перевіряємо проміжний шар напряму.
        $redirect = (new CanonicalUrl)->handle(Request::create('/games/?page=2'), fn () => response('next'));
        $this->assertSame(301, $redirect->getStatusCode());
        $this->assertSame('http://localhost/games?page=2', $redirect->headers->get('Location'));
        $this->assertSame('next', (new CanonicalUrl)->handle(Request::create('/games'), fn () => response('next'))->getContent());
        // MySQL шукає нік без урахування регістру → 301 на справжній; SQLite у тестах — регістр важливий, тож 404. Дублікату немає в обох.
        $upper = $this->get('/OLENA');
        DB::connection()->getDriverName() === 'sqlite' ? $upper->assertNotFound() : $upper->assertStatus(301)->assertRedirect('/olena');
        $this->get('/olena')->assertOk();
    }
}
