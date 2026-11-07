<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\User;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
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
        $this->assertStringNotContainsString('/games/apex', $this->get('/sitemap.xml')->getContent());
    }

    public function test_sitemap_lists_published_games(): void
    {
        $this->game();
        $this->game(['slug' => 'draft', 'name' => 'Draft', 'is_published' => false]);

        $xml = $this->get('/sitemap.xml')->assertOk()->getContent();

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
}
