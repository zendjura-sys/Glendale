<?php

namespace Tests\Feature;

use App\Models\GcGiftPack;
use App\Models\LiveShow;
use App\Models\LiveShowLike;
use App\Models\User;
use App\Models\UserGcGift;
use App\Services\Ai\AiClient;
use App\Services\Shows\LiveShows;
use App\Support\Settings\SiteSettings;
use App\Support\Shows\GiftRarities;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Паки подарунків GameCast, лайки й ШІ-помічник ефіру. */
class GameCastGiftsAndAiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Http::fake(['voice.gamecon.test/twirp/*' => Http::response([], 200)]);
        $settings = app(SiteSettings::class);
        $settings->put(['livekit_url' => 'wss://voice.gamecon.test', 'livekit_api_key' => 'APIgamecon']);
        $settings->putSecret('livekit_api_secret', 'test-livekit-secret-0123456789');
        $settings->put(['ai_provider' => 'openai', 'ai_model' => 'gpt-test']);
        $settings->putSecret('ai_key', 'test-ai-key');
        $settings->put(['plugins' => [
            'live_shows' => true,
            'ai_gamecast' => true,
            'ai_livecast' => true,
        ]]);
    }

    public function test_admin_creates_named_pack_and_user_buys_opens_gifts(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->post('/admin/gift-packs', [
            'name' => 'Мій унікальний пак',
            'description' => 'Тест',
            'emoji' => '🎁',
            'price' => 100,
            'gifts_count' => 3,
            'pity_after' => 5,
            'odds' => GiftRarities::defaultOdds(),
            'is_active' => true,
        ])->assertRedirect();

        $pack = GcGiftPack::query()->where('name', 'Мій унікальний пак')->sole();
        $this->assertSame('Мій унікальний пак', $pack->name);

        $fan = User::factory()->create(['balance' => 10_000]);
        $this->actingAs($fan)->postJson(route('shows.gifts.buy', $pack))
            ->assertOk()
            ->assertJsonPath('pack.name', 'Мій унікальний пак')
            ->assertJsonCount(3, 'opened');

        $this->assertSame(3, UserGcGift::query()->where('user_id', $fan->id)->where('status', UserGcGift::READY)->count());
        $this->assertSame(9900, (int) $fan->fresh()->balance);
    }

    public function test_like_and_gift_host_on_live_show(): void
    {
        $host = User::factory()->create();
        $fan = User::factory()->create(['balance' => 50_000]);
        $show = app(LiveShows::class)->create($host, [
            'title' => 'Нічний рейд',
            'format' => 'duo',
        ]);
        $this->assertSame(LiveShow::LIVE, $show->status);

        $pack = GcGiftPack::query()->active()->firstOrFail();
        $this->actingAs($fan)->postJson(route('shows.gifts.buy', $pack))->assertOk();
        $owned = UserGcGift::query()->where('user_id', $fan->id)->where('status', UserGcGift::READY)->firstOrFail();

        $this->actingAs($fan)->postJson(route('shows.like', [$show, $host]))
            ->assertOk()
            ->assertJsonPath('liked', true);
        $this->assertSame(1, LiveShowLike::query()->where('live_show_id', $show->id)->count());

        $this->actingAs($fan)->postJson(route('shows.gift', [$show, $host]), [
            'user_gift_id' => $owned->id,
        ])->assertOk()->assertJsonPath('gift.to.id', $host->id);

        $this->assertSame(UserGcGift::GIFTED, $owned->fresh()->status);

        $state = $this->actingAs($fan)->getJson(route('shows.state', $show))->assertOk()->json();
        $this->assertNotEmpty($state['recent_gifts']);
        $this->assertGreaterThanOrEqual(1, $state['stage'][0]['likes'] ?? 0);
    }

    public function test_gamecast_ai_watch_uses_site_ai_key(): void
    {
        Http::fake([
            'voice.gamecon.test/twirp/*' => Http::response([], 200),
            'api.openai.com/*' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'mood' => 'жваво',
                            'risks' => [],
                            'tips' => ['Покличте людей з черги рук'],
                            'promo' => 'Заходьте на нічний рейд!',
                        ], JSON_UNESCAPED_UNICODE),
                    ],
                ]],
            ], 200),
        ]);

        $host = User::factory()->create();
        $show = app(LiveShows::class)->create($host, ['title' => 'Нічний рейд', 'format' => 'duo']);

        $this->actingAs($host)->postJson(route('shows.ai.watch', $show))
            ->assertOk()
            ->assertJsonPath('mood', 'жваво')
            ->assertJsonPath('promo', 'Заходьте на нічний рейд!');

        $this->assertTrue(app(AiClient::class)->configured());
    }
}
