<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameGiveaway;
use App\Models\GameWishlist;
use App\Models\User;
use App\Notifications\GameDealNotice;
use App\Services\Games\Giveaways;
use App\Services\Games\Hardware;
use App\Services\Games\SteamStore;
use App\Services\Games\WishlistAlerts;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Sleep;
use Tests\TestCase;

/** Роздачі ігор, бажане зі знижками, «чи потягне мій ПК». */
class GameDealsTest extends TestCase
{
    use RefreshDatabase;

    private const REQ_MIN = '<strong>Minimum:</strong><br><ul class="bb_ul"><li><strong>OS:</strong> Windows 10 64-bit<br></li><li><strong>Processor:</strong> Intel Core i5-4460 or AMD FX-6300<br></li><li><strong>Memory:</strong> 8 GB RAM<br></li><li><strong>Graphics:</strong> NVIDIA GeForce GTX 970, 4 GB or AMD Radeon RX 480<br></li><li><strong>Storage:</strong> 50 GB available space</li></ul>';

    private const REQ_REC = '<strong>Recommended:</strong><br><ul class="bb_ul"><li><strong>Processor:</strong> Intel Core i7-8700K / AMD Ryzen 5 3600X<br></li><li><strong>Memory:</strong> 16 GB RAM<br></li><li><strong>Graphics:</strong> NVIDIA GeForce RTX 2070 or AMD Radeon RX 5700 XT</li></ul>';

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Sleep::fake();
    }

    private function game(): Game
    {
        return Game::query()->create([
            'slug' => 'portal-2', 'name' => 'Portal 2', 'letter' => 'P', 'category' => 'pc', 'is_published' => true,
            'links' => [['store' => 'steam', 'url' => 'https://store.steampowered.com/app/620/Portal_2/']],
        ]);
    }

    private function fakeStores(float $price = 1.99, float $savings = 90.0): void
    {
        Http::fake([
            'store.steampowered.com/api/appdetails*' => Http::response(['620' => ['success' => true, 'data' => [
                'is_free' => false,
                'price_overview' => ['currency' => 'USD', 'discount_percent' => 80, 'initial_formatted' => '$9.99', 'final_formatted' => '$1.99'],
                'pc_requirements' => ['minimum' => self::REQ_MIN, 'recommended' => self::REQ_REC],
            ]]]),
            'www.cheapshark.com/api/1.0/stores' => Http::response([['storeID' => '1', 'storeName' => 'Steam', 'isActive' => 1], ['storeID' => '7', 'storeName' => 'GOG', 'isActive' => 1]]),
            'www.cheapshark.com/api/1.0/games?steamAppID=620' => Http::response([['gameID' => '612', 'steamAppID' => '620']]),
            'www.cheapshark.com/api/1.0/games?id=612' => Http::response([
                'cheapestPriceEver' => ['price' => '0.99'],
                'deals' => [
                    ['storeID' => '7', 'dealID' => 'abc', 'price' => (string) $price, 'retailPrice' => '19.99', 'savings' => (string) $savings],
                    ['storeID' => '1', 'dealID' => 'def', 'price' => '9.99', 'retailPrice' => '9.99', 'savings' => '0'],
                ],
            ]),
        ]);
    }

    public function test_game_page_shows_prices_and_wishlist(): void
    {
        $this->fakeStores();
        $game = $this->game();
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/games/portal-2/prices')->assertOk()
            ->assertJsonPath('steam.final', '$1.99')
            ->assertJsonPath('deals.0.store', 'GOG')
            ->assertJsonPath('deals.0.price', 1.99)
            ->assertJsonPath('deals.0.url', 'https://www.cheapshark.com/redirect?dealID=abc')
            ->assertJsonPath('lowest_ever', 0.99)
            ->assertJsonPath('wished', false);

        $this->actingAs($user)->postJson('/games/portal-2/wish', ['on' => true, 'target_price' => 5])
            ->assertOk()->assertJsonPath('wished', true)->assertJsonPath('target_price', 5);
        $this->assertDatabaseHas('game_wishlists', ['user_id' => $user->id, 'game_id' => $game->id]);

        $this->actingAs($user)->get('/games/deals')->assertInertia(fn ($page) => $page
            ->component('games/deals')->has('wishlist', 1)->where('wishlist.0.best.price', 1.99));

        $this->actingAs($user)->postJson('/games/portal-2/wish', ['on' => false])->assertJsonPath('wished', false);
        $this->assertDatabaseCount('game_wishlists', 0);
    }

    public function test_price_drop_notifies_once_until_price_falls_again(): void
    {
        Notification::fake();
        $this->fakeStores();
        $game = $this->game();
        $user = User::factory()->create();
        GameWishlist::query()->create(['user_id' => $user->id, 'game_id' => $game->id]);

        $this->assertSame(1, app(WishlistAlerts::class)->run()['notified']);
        $this->assertSame(0, app(WishlistAlerts::class)->run()['notified']);
        Notification::assertSentTo($user, GameDealNotice::class, fn (GameDealNotice $n) => $n->kind === 'price_drop'
            && str_contains($n->text, '−90%') && str_contains($n->text, 'GOG'));

        // Ціна ще впала — нове сповіщення.
        $wish = GameWishlist::query()->sole();
        $this->assertTrue(app(WishlistAlerts::class)->check($wish, $game, ['store' => 'GOG', 'price' => 0.99, 'retail' => 19.99, 'savings' => 95, 'url' => 'x']));
        // Знижка скінчилась — позначку знято, наступна знову сповістить.
        $this->assertFalse(app(WishlistAlerts::class)->check($wish->refresh(), $game, ['store' => 'GOG', 'price' => 19.99, 'retail' => 19.99, 'savings' => 0, 'url' => 'x']));
        $this->assertNull($wish->refresh()->notified_price);
    }

    public function test_target_price_waits_until_reached(): void
    {
        Notification::fake();
        $game = $this->game();
        $wish = GameWishlist::query()->create(['user_id' => User::factory()->create()->id, 'game_id' => $game->id, 'target_price' => 1.00]);

        $this->assertFalse(app(WishlistAlerts::class)->check($wish, $game, ['store' => 'GOG', 'price' => 1.99, 'retail' => 19.99, 'savings' => 90, 'url' => 'x']));
        $this->assertTrue(app(WishlistAlerts::class)->check($wish, $game, ['store' => 'GOG', 'price' => 0.99, 'retail' => 19.99, 'savings' => 95, 'url' => 'x']));
    }

    public function test_giveaways_sync_and_notify_subscribers_and_wishers(): void
    {
        Notification::fake();
        $game = $this->game();
        $subscriber = User::factory()->create(['preferences' => ['giveaways' => true]]);
        $wisher = User::factory()->create();
        $other = User::factory()->create();
        GameWishlist::query()->create(['user_id' => $wisher->id, 'game_id' => $game->id]);
        Http::fake(['www.gamerpower.com/api/filter*' => Http::sequence()
            ->push([
                ['id' => 3001, 'title' => 'Portal 2 (Epic Games) Giveaway', 'worth' => '$9.99', 'image' => 'https://img/p2.jpg', 'description' => 'Free!', 'open_giveaway_url' => 'https://gp/open/3001', 'published_date' => '2026-10-24 10:00:00', 'end_date' => '2099-10-31 23:59:00', 'platforms' => 'PC, Epic Games Store'],
                ['id' => 3002, 'title' => 'Old Game Giveaway', 'worth' => 'N/A', 'open_giveaway_url' => 'https://gp/open/3002', 'end_date' => 'N/A', 'platforms' => 'PC, GOG'],
            ])
            ->push([
                ['id' => 3001, 'title' => 'Portal 2 (Epic Games) Giveaway', 'worth' => '$9.99', 'open_giveaway_url' => 'https://gp/open/3001', 'end_date' => '2099-10-31 23:59:00', 'platforms' => 'PC, Epic Games Store'],
            ]),
        ]);

        $this->assertSame(['new' => 2, 'active' => 2], app(Giveaways::class)->sync());
        $portal = GameGiveaway::query()->where('external_id', 3001)->sole();
        $this->assertSame('Portal 2', $portal->title);
        $this->assertSame('epic', $portal->store);
        $this->assertSame($game->id, $portal->game_id);
        Notification::assertSentTo($wisher, GameDealNotice::class, fn (GameDealNotice $n) => str_contains($n->text, 'списку бажаного'));
        Notification::assertSentToTimes($subscriber, GameDealNotice::class, 2);
        Notification::assertNotSentTo($other, GameDealNotice::class);

        // Наступна синхронізація: 3002 зникла — роздача неактивна, повторних сповіщень немає.
        $this->assertSame(['new' => 0, 'active' => 1], app(Giveaways::class)->sync());
        $this->assertFalse(GameGiveaway::query()->where('external_id', 3002)->value('active'));
        Notification::assertSentToTimes($subscriber, GameDealNotice::class, 2);

        $this->actingAs($other)->get('/games/deals')->assertInertia(fn ($page) => $page->has('giveaways', 1)->where('subscribed', false));
        $this->actingAs($other)->post('/games/deals/subscribe', ['on' => true])->assertRedirect();
        $this->assertTrue($other->refresh()->pref('giveaways'));
    }

    public function test_empty_giveaway_answer_changes_nothing(): void
    {
        GameGiveaway::query()->create(['external_id' => 1, 'title' => 'X', 'store' => 'epic', 'url' => 'https://x']);
        Http::fake(['www.gamerpower.com/api/filter*' => Http::response(['status' => 0, 'status_message' => 'No active giveaways'], 201)]);

        $this->assertNull(app(Giveaways::class)->sync());
        $this->assertTrue(GameGiveaway::query()->sole()->active);
    }

    public function test_pc_check_compares_build_with_steam_requirements(): void
    {
        $this->fakeStores();
        $this->game();
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/games/portal-2/pc-check')->assertOk()
            ->assertJsonPath('configured', false)->assertJsonPath('summary', null)
            ->assertJsonPath('requirements.minimum.cpu', 'Intel Core i5-4460 or AMD FX-6300')
            ->assertJsonPath('requirements.minimum.ram', '8 GB RAM');

        $this->actingAs($user)->putJson('/games/pc', ['cpu' => 'Intel Core i5-10400F', 'gpu' => 'GeForce GTX 1660 Super', 'ram' => 16])
            ->assertOk()->assertJsonPath('cpu_known', true)->assertJsonPath('gpu_known', true);
        $this->actingAs($user)->getJson('/games/portal-2/pc-check')
            ->assertJsonPath('summary', 'minimum')
            ->assertJsonPath('minimum.verdict', 'ok')
            ->assertJsonPath('recommended.gpu', 'fail');

        $this->actingAs($user)->putJson('/games/pc', ['cpu' => 'Ryzen 7 5800X', 'gpu' => 'RTX 3070', 'ram' => 32]);
        $this->actingAs($user)->getJson('/games/portal-2/pc-check')->assertJsonPath('summary', 'recommended');

        $this->actingAs($user)->putJson('/games/pc', ['cpu' => 'Core 2 Duo E8400', 'gpu' => 'GT 730', 'ram' => 4]);
        $this->actingAs($user)->getJson('/games/portal-2/pc-check')->assertJsonPath('summary', 'below');

        $this->actingAs($user)->putJson('/games/pc', ['cpu' => 'Мій кастомний проц', 'gpu' => null, 'ram' => 8])->assertJsonPath('cpu_known', false);
    }

    public function test_hardware_recognition(): void
    {
        $this->assertSame(Hardware::GPUS['GTX 1660 Super'], Hardware::gpu('NVIDIA GeForce GTX 1660 SUPER 6GB'));
        $this->assertSame(Hardware::GPUS['GTX 1660'], Hardware::gpu('GTX 1660'));
        $this->assertSame(Hardware::GPUS['RX 580'], Hardware::gpu('AMD Radeon RX 580 8GB'));
        $this->assertNull(Hardware::gpu('DirectX 11 compatible'));
        $this->assertGreaterThan(Hardware::cpu('Intel Core i5-4460'), Hardware::cpu('Intel Core i5-12400F'));
        $this->assertGreaterThan(Hardware::cpu('Ryzen 5 1600'), Hardware::cpu('Ryzen 5 5600X'));
        $this->assertLessThan(Hardware::cpu('Intel Core i7-8700'), Hardware::cpu('Intel Core i7-8550U'));
        $this->assertSame(Hardware::cpu('Intel Core i5-2400') > Hardware::cpu('Intel Core i5 750'), true);
        $this->assertSame(4096.0 / 1024, Hardware::ram('4096 MB RAM'));
        $this->assertSame(['os' => 'Windows 10 64-bit', 'cpu' => 'Intel Core i5-4460 or AMD FX-6300', 'ram' => '8 GB RAM', 'gpu' => 'NVIDIA GeForce GTX 970, 4 GB or AMD Radeon RX 480', 'storage' => '50 GB available space'], SteamStore::parse(self::REQ_MIN));
    }

    public function test_plugins_switch_features_off(): void
    {
        $this->game();
        $user = User::factory()->create();
        app(Plugins::class)->set('pc_check', false);

        $this->actingAs($user)->getJson('/games/portal-2/pc-check')->assertNotFound();
    }
}
