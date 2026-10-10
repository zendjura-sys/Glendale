<?php

namespace Tests\Feature;

use App\Models\Family;
use App\Models\GtaServer;
use App\Models\PartyPost;
use App\Models\PlusCode;
use App\Models\PlusGrant;
use App\Models\PlusPayment;
use App\Models\ServerPromotion;
use App\Models\User;
use App\Notifications\PlusGifted;
use App\Services\Families\FamilyService;
use App\Services\Plus\Plus;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GameconPlusTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'whsec-test-123';

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $settings = app(SiteSettings::class);
        $settings->putSecret('lemonsqueezy_api_key', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.test');
        $settings->putSecret('lemonsqueezy_webhook_secret', self::SECRET);
        $settings->put([
            'lemonsqueezy_store_id' => '777',
            'ls_variant_plus_month' => '1001',
            'ls_variant_plus_year' => '1002',
            'ls_variant_gift_month' => '1003',
            'ls_variant_family_month' => '1005',
            'ls_variant_promo_top_7' => '1007',
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function hook(array $payload, ?string $secret = self::SECRET)
    {
        $body = json_encode($payload, JSON_THROW_ON_ERROR);

        return $this->call('POST', '/api/payments/lemonsqueezy', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_SIGNATURE' => hash_hmac('sha256', $body, (string) $secret),
        ], $body);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  array<string, string>  $custom
     * @return array<string, mixed>
     */
    private function event(string $name, string $id, array $attributes, array $custom = []): array
    {
        return [
            'meta' => ['event_name' => $name, 'custom_data' => $custom],
            'data' => ['type' => str_starts_with($name, 'order') ? 'orders' : 'subscriptions', 'id' => $id, 'attributes' => $attributes],
        ];
    }

    public function test_webhook_signature_is_required(): void
    {
        $this->hook($this->event('subscription_created', '1', []), 'wrong')->assertStatus(401);
        $this->postJson('/api/payments/lemonsqueezy', [])->assertStatus(401);
    }

    public function test_subscription_lifecycle_sets_and_clears_plus(): void
    {
        $user = User::factory()->create();
        $custom = ['user_id' => (string) $user->id, 'product' => 'plus_month'];
        $renews = now()->addMonth();

        $this->hook($this->event('subscription_created', 'sub_1', [
            'status' => 'active', 'variant_id' => 1001, 'renews_at' => $renews->toIso8601String(), 'ends_at' => null,
            'urls' => ['customer_portal' => 'https://gamecon.lemonsqueezy.com/billing'],
        ], $custom))->assertNoContent();

        $user->refresh();
        $this->assertTrue($user->isPlus());
        $this->assertNotNull($user->toCard()['plus']);
        $this->actingAs($user)->get('/plus')->assertInertia(fn (Assert $page) => $page
            ->component('plus/index')
            ->where('state.active', true)
            ->where('state.subscription.portal_url', 'https://gamecon.lemonsqueezy.com/billing'));

        // Скасування: доступ до кінця оплаченого періоду.
        $ends = now()->addDays(10);
        $this->hook($this->event('subscription_cancelled', 'sub_1', ['status' => 'cancelled', 'variant_id' => 1001, 'renews_at' => null, 'ends_at' => $ends->toIso8601String()], $custom));
        $this->assertTrue($user->fresh()->isPlus());
        $this->assertSame($ends->toDateString(), $user->fresh()->plus_until->toDateString());

        $this->hook($this->event('subscription_expired', 'sub_1', ['status' => 'expired', 'variant_id' => 1001], $custom));
        $this->assertFalse($user->fresh()->isPlus());
        $this->assertNull($user->fresh()->toCard()['plus']);
    }

    public function test_gift_order_grants_recipient_and_refund_revokes(): void
    {
        Notification::fake();
        [$payer, $friend] = User::factory()->count(2)->create();
        $order = $this->event('order_created', 'ord_1', [
            'status' => 'paid', 'total' => 360, 'currency' => 'USD', 'first_order_item' => ['variant_id' => 1003],
        ], ['user_id' => (string) $payer->id, 'to_user_id' => (string) $friend->id, 'product' => 'gift_month']);

        $this->hook($order)->assertNoContent();
        $this->hook($order)->assertNoContent(); // повтор від Lemon Squeezy не дублює подарунок

        $this->assertTrue($friend->fresh()->isPlus());
        $this->assertFalse($payer->fresh()->isPlus());
        $this->assertSame(1, PlusGrant::query()->where('source', 'gift')->count());
        Notification::assertSentTo($friend, PlusGifted::class);

        $this->hook($this->event('order_refunded', 'ord_1', ['status' => 'refunded']));
        $this->assertFalse($friend->fresh()->isPlus());
        $this->assertSame(PlusPayment::REFUNDED, PlusPayment::query()->value('status'));
    }

    public function test_checkout_creates_link_with_custom_data(): void
    {
        $user = User::factory()->create();
        $friend = User::factory()->create(['username' => 'olena']);
        Http::fake(['api.lemonsqueezy.com/v1/checkouts' => Http::response(['data' => ['attributes' => ['url' => 'https://gamecon.lemonsqueezy.com/checkout/abc']]], 201)]);

        $this->actingAs($user)->postJson('/plus/checkout', ['product' => 'gift_month', 'username' => '@olena'])
            ->assertOk()->assertJsonPath('url', 'https://gamecon.lemonsqueezy.com/checkout/abc');

        Http::assertSent(fn (HttpRequest $request) => $request['data']['relationships']['variant']['data']['id'] === '1003'
            && $request['data']['attributes']['checkout_data']['custom']['to_user_id'] === (string) $friend->id
            && $request['data']['attributes']['checkout_data']['custom']['user_id'] === (string) $user->id);

        // Товар без ID варіанта — оплата недоступна.
        $this->actingAs($user)->postJson('/plus/checkout', ['product' => 'gift_year', 'username' => 'olena'])->assertStatus(503);
        $this->actingAs($user)->postJson('/plus/checkout', ['product' => 'gift_month', 'username' => 'nobody'])->assertStatus(422);
    }

    public function test_promo_code_can_be_redeemed_once_per_person(): void
    {
        [$a, $b, $c] = User::factory()->count(3)->create();
        PlusCode::query()->create(['code' => 'GAMECON-30', 'days' => 30, 'max_uses' => 2]);

        $this->actingAs($a)->post('/plus/redeem', ['code' => 'gamecon-30'])->assertRedirect();
        $this->assertTrue($a->fresh()->isPlus());
        $this->actingAs($a)->post('/plus/redeem', ['code' => 'GAMECON-30'])->assertStatus(422);
        $this->actingAs($b)->post('/plus/redeem', ['code' => 'GAMECON-30'])->assertRedirect();
        $this->actingAs($c)->post('/plus/redeem', ['code' => 'GAMECON-30'])->assertStatus(422);
    }

    public function test_gifts_and_codes_stack_one_after_another(): void
    {
        $user = User::factory()->create();
        $plus = app(Plus::class);
        $plus->grant($user, 30, 'admin');
        $plus->grant($user, 30, 'code');

        $this->assertSame(now()->addDays(60)->toDateString(), $user->fresh()->plus_until->toDateString());
    }

    public function test_perks_follow_the_subscription(): void
    {
        $user = User::factory()->create();
        for ($i = 0; $i < 3; $i++) {
            PartyPost::query()->create(['user_id' => $user->id, 'title' => 'Паті '.$i, 'slots' => 4, 'expires_at' => now()->addHours(3)]);
        }
        $this->actingAs($user)->post('/party', ['title' => 'Ще одна', 'slots' => 4])->assertStatus(422);
        $this->actingAs($user)->put('/plus/style', ['name' => 'aurora'])->assertForbidden();

        app(Plus::class)->grant($user, 30, 'admin');
        $this->actingAs($user)->post('/party', ['title' => 'Ще одна', 'slots' => 4])->assertRedirect();

        $this->actingAs($user)->put('/plus/style', ['name' => 'aurora', 'frame' => 'season', 'accent' => 'ocean'])->assertRedirect();
        $card = $user->fresh()->toCard()['plus'];
        $this->assertSame(['#4f8bff', '#a855f7'], $card['name']);
        $this->assertCount(2, $card['frame']);

        // Підняти своє паті — раз на добу.
        $party = PartyPost::query()->where('user_id', $user->id)->latest('id')->first();
        $this->actingAs($user)->post("/party/{$party->id}/bump")->assertRedirect();
        $this->assertTrue($party->fresh()->bumped_until->isFuture());
        $this->actingAs($user)->post("/party/{$party->id}/bump")->assertStatus(429);
    }

    public function test_family_subscription_and_server_promotion(): void
    {
        $server = GtaServer::query()->create([
            'slug' => 'quant', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        GtaServer::query()->create([
            'slug' => 'stake', 'name' => 'Stake RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed', 'players_online' => 900,
        ]);
        $leader = User::factory()->create();
        $server->forceFill(['owner_id' => $leader->id])->save();
        $family = app(FamilyService::class)->create($leader, [
            'server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001',
        ]);
        $family->forceFill(['status' => Family::STATUS_VERIFIED])->save();

        $this->hook($this->event('subscription_created', 'sub_f', [
            'status' => 'active', 'variant_id' => 1005, 'renews_at' => now()->addMonth()->toIso8601String(),
        ], ['user_id' => (string) $leader->id, 'family_id' => (string) $family->id, 'product' => 'family_month']));
        $this->assertTrue($family->fresh()->isPlus());
        $this->assertFalse($leader->fresh()->isPlus());
        $this->assertNotNull($family->fresh()->toCard()['plus']);

        $this->hook($this->event('order_created', 'ord_p', [
            'status' => 'paid', 'total' => 1200, 'currency' => 'USD', 'first_order_item' => ['variant_id' => 1007],
        ], ['user_id' => (string) $leader->id, 'server_id' => (string) $server->id, 'product' => 'promo_top_7']));
        $this->assertSame(1, ServerPromotion::query()->live()->count());

        // Просуваний сервер — першим, попри менший онлайн.
        $this->actingAs($leader)->get('/servers?lang=all')->assertInertia(fn (Assert $page) => $page
            ->where('servers.0.slug', 'quant')
            ->where('servers.0.promo', ['top'])
            ->where('servers.1.slug', 'stake'));
        $this->actingAs($leader)->get(route('servers.show', $server))
            ->assertInertia(fn (Assert $page) => $page->has('promotion.active', 1));
    }

    public function test_admin_grants_codes_and_sees_payments(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create(['username' => 'taras']);

        $this->actingAs($user)->get('/admin/plus')->assertForbidden();
        $this->actingAs($admin)->post('/admin/plus/grants', ['username' => '@taras', 'days' => 14, 'note' => 'Допомога з перекладом'])->assertRedirect();
        $this->assertTrue($user->fresh()->isPlus());
        $this->actingAs($admin)->post('/admin/plus/codes', ['days' => 7, 'max_uses' => 10])->assertSessionHasNoErrors();

        $this->actingAs($admin)->get('/admin/plus')->assertInertia(fn (Assert $page) => $page
            ->component('admin/plus')
            ->where('stats.users', 1)
            ->has('grants', 1)
            ->has('codes', 1));

        $grant = PlusGrant::query()->firstOrFail();
        $this->actingAs($admin)->delete("/admin/plus/grants/{$grant->id}")->assertRedirect();
        $this->assertFalse($user->fresh()->isPlus());
    }
}
