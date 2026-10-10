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
use App\Services\Plus\Paddle;
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

    private const SECRET = 'pdl_ntfset_test_secret_123';

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $settings = app(SiteSettings::class);
        $settings->putSecret('paddle_api_key', 'pdl_sdbx_apikey_0123456789abcdef');
        $settings->putSecret('paddle_webhook_secret', self::SECRET);
        $settings->put([
            'paddle_seller_id' => '12345',
            'paddle_client_token' => 'test_0123456789abcdef',
            'paddle_sandbox' => true,
            'paddle_price_plus_month' => 'pri_plusmonth0001',
            'paddle_price_plus_year' => 'pri_plusyear00001',
            'paddle_price_gift_month' => 'pri_giftmonth0001',
            'paddle_price_family_month' => 'pri_familymonth01',
            'paddle_price_promo_top_7' => 'pri_promotop70001',
        ]);
        app(Paddle::class)->applyConfig();
    }

    /** Вебхук Paddle з підписом Paddle-Signature: ts=…;h1=HMAC(ts:тіло). */
    private function hook(string $type, array $data, ?string $secret = self::SECRET)
    {
        $body = json_encode(['event_id' => 'evt_'.uniqid(), 'event_type' => $type, 'occurred_at' => now()->toIso8601String(), 'data' => $data], JSON_THROW_ON_ERROR);
        $ts = time();

        return $this->call('POST', '/paddle/webhook', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_PADDLE_SIGNATURE' => "ts={$ts};h1=".hash_hmac('sha256', "{$ts}:{$body}", (string) $secret),
        ], $body);
    }

    private function customer(User $user, string $id = 'ctm_01'): void
    {
        $user->customer()->create(['paddle_id' => $id, 'name' => $user->name, 'email' => $user->email]);
    }

    /**
     * @return array<string, mixed>
     */
    private function subscription(string $id, string $customer, string $price, string $status = 'active', array $extra = []): array
    {
        return [
            'id' => $id,
            'customer_id' => $customer,
            'status' => $status,
            'custom_data' => ['subscription_type' => 'default'],
            'items' => [['price' => ['id' => $price, 'product_id' => 'pro_01'], 'status' => 'active', 'quantity' => 1]],
            'next_billed_at' => now()->addMonth()->toIso8601String(),
            'current_billing_period' => ['starts_at' => now()->toIso8601String(), 'ends_at' => now()->addMonth()->toIso8601String()],
            'scheduled_change' => null,
            ...$extra,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function transaction(string $id, string $customer, string $price, array $custom): array
    {
        return [
            'id' => $id,
            'customer_id' => $customer,
            'subscription_id' => null,
            'invoice_number' => '2026-1',
            'status' => 'completed',
            'details' => ['totals' => ['total' => '360', 'tax' => '60']],
            'currency_code' => 'USD',
            'billed_at' => now()->toIso8601String(),
            'items' => [['price' => ['id' => $price, 'product_id' => 'pro_02'], 'quantity' => 1]],
            'custom_data' => $custom,
        ];
    }

    public function test_webhook_signature_is_required(): void
    {
        $this->hook('subscription.created', ['id' => 'sub_x'], 'wrong')->assertStatus(403);
    }

    public function test_subscription_lifecycle_sets_and_clears_plus(): void
    {
        $user = User::factory()->create();
        $this->customer($user);

        $this->hook('subscription.created', $this->subscription('sub_01', 'ctm_01', 'pri_plusmonth0001'))->assertOk();

        $user->refresh();
        $this->assertTrue($user->isPlus());
        $this->assertTrue($user->is_premium);
        $this->assertTrue($user->subscribed('default'));
        $this->assertNotNull($user->toCard()['plus']);
        $this->actingAs($user)->get('/plus')->assertInertia(fn (Assert $page) => $page
            ->component('plus/index')
            ->where('state.active', true)
            ->where('state.subscription.product', 'plus_month')
            ->where('state.subscription.cancelled', false));

        // Скасування в кінці періоду: доступ до дати скасування, onGracePeriod().
        $ends = now()->addDays(10);
        $this->hook('subscription.updated', $this->subscription('sub_01', 'ctm_01', 'pri_plusmonth0001', 'active', [
            'scheduled_change' => ['action' => 'cancel', 'effective_at' => $ends->toIso8601String()],
        ]))->assertOk();
        $user->refresh();
        $this->assertTrue($user->isPlus());
        $this->assertTrue($user->subscription('default')->onGracePeriod());
        $this->assertSame($ends->toDateString(), $user->premium_until->toDateString());
        $this->actingAs($user)->getJson('/plus/status')->assertJsonPath('on_grace_period', true)->assertJsonPath('subscription.cancelled', true);

        $this->hook('subscription.canceled', $this->subscription('sub_01', 'ctm_01', 'pri_plusmonth0001', 'canceled', ['canceled_at' => now()->toIso8601String()]))->assertOk();
        $this->assertFalse($user->fresh()->isPlus());
        $this->assertNull($user->fresh()->toCard()['plus']);
    }

    public function test_gift_transaction_grants_recipient_and_refund_revokes(): void
    {
        Notification::fake();
        [$payer, $friend] = User::factory()->count(2)->create();
        $this->customer($payer);
        $data = $this->transaction('txn_01', 'ctm_01', 'pri_giftmonth0001', ['user_id' => (string) $payer->id, 'to_user_id' => (string) $friend->id, 'product' => 'gift_month']);

        $this->hook('transaction.completed', $data)->assertOk();
        $this->hook('transaction.completed', $data)->assertOk(); // повтор від Paddle не дублює подарунок

        $this->assertTrue($friend->fresh()->isPlus());
        $this->assertFalse($payer->fresh()->isPlus());
        $this->assertSame(1, PlusGrant::query()->where('source', 'gift')->count());
        $this->assertSame(360, PlusPayment::query()->value('amount'));
        Notification::assertSentTo($friend, PlusGifted::class);

        $this->hook('adjustment.created', ['id' => 'adj_01', 'action' => 'refund', 'status' => 'approved', 'transaction_id' => 'txn_01'])->assertOk();
        $this->assertFalse($friend->fresh()->isPlus());
        $this->assertSame(PlusPayment::REFUNDED, PlusPayment::query()->value('status'));
    }

    public function test_checkout_creates_paddle_transaction_with_custom_data(): void
    {
        $user = User::factory()->create();
        $friend = User::factory()->create(['username' => 'olena']);
        Http::fake(function (HttpRequest $request) {
            return match (true) {
                $request->method() === 'GET' && str_contains($request->url(), '/customers') => Http::response(['data' => []]),
                $request->method() === 'POST' && str_ends_with($request->url(), '/customers') => Http::response(['data' => ['id' => 'ctm_new', 'name' => 'X', 'email' => $request['email']]]),
                $request->method() === 'POST' && str_ends_with($request->url(), '/transactions') => Http::response(['data' => ['id' => 'txn_checkout01']]),
                default => Http::response(['error' => ['detail' => 'unexpected']], 400),
            };
        });

        $this->actingAs($user)->postJson('/plus/checkout', ['product' => 'gift_month', 'username' => '@olena'])
            ->assertOk()
            ->assertJsonPath('transaction_id', 'txn_checkout01')
            ->assertJsonPath('client_token', 'test_0123456789abcdef')
            ->assertJsonPath('sandbox', true);

        Http::assertSent(fn (HttpRequest $r) => str_starts_with($r->url(), 'https://sandbox-api.paddle.com/transactions')
            && $r['items'][0]['price_id'] === 'pri_giftmonth0001'
            && $r['customer_id'] === 'ctm_new'
            && $r['custom_data']['to_user_id'] === (string) $friend->id
            && $r['custom_data']['user_id'] === (string) $user->id);
        $this->assertSame('ctm_new', $user->fresh()->customer->paddle_id);

        // Товар без Price ID — оплата недоступна; невідомий нік — помилка.
        $this->actingAs($user)->postJson('/plus/checkout', ['product' => 'gift_year', 'username' => 'olena'])->assertStatus(503);
        $this->actingAs($user)->postJson('/plus/checkout', ['product' => 'gift_month', 'username' => 'nobody'])->assertStatus(422);
    }

    public function test_one_click_cancel_and_resume(): void
    {
        $user = User::factory()->create();
        $this->customer($user);
        $this->hook('subscription.created', $this->subscription('sub_02', 'ctm_01', 'pri_plusyear00001'))->assertOk();
        Http::fake([
            'sandbox-api.paddle.com/subscriptions/sub_02/cancel' => Http::response(['data' => $this->subscription('sub_02', 'ctm_01', 'pri_plusyear00001', 'active', [
                'scheduled_change' => ['action' => 'cancel', 'effective_at' => now()->addYear()->toIso8601String()],
            ])]),
            'sandbox-api.paddle.com/subscriptions/sub_02' => Http::response(['data' => $this->subscription('sub_02', 'ctm_01', 'pri_plusyear00001')]),
        ]);

        $this->actingAs($user)->post('/plus/cancel', ['type' => 'default'])->assertRedirect();
        $this->assertTrue($user->fresh()->subscription('default')->onGracePeriod());

        $this->actingAs($user)->post('/plus/resume', ['type' => 'default'])->assertRedirect();
        $this->assertFalse($user->fresh()->subscription('default')->onGracePeriod());
        $this->actingAs($user)->post('/plus/cancel', ['type' => 'family:99'])->assertNotFound();
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
        $this->customer($leader);
        $server->forceFill(['owner_id' => $leader->id])->save();
        $family = app(FamilyService::class)->create($leader, [
            'server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001',
        ]);
        $family->forceFill(['status' => Family::STATUS_VERIFIED])->save();

        // Сімейна підписка — підписка лідера з типом family:{id}; GameCon+ отримує сім’я, не лідер.
        $this->hook('subscription.created', $this->subscription('sub_f', 'ctm_01', 'pri_familymonth01', 'active', [
            'custom_data' => ['subscription_type' => 'family:'.$family->id, 'family_id' => (string) $family->id],
        ]))->assertOk();
        $this->assertTrue($family->fresh()->isPlus());
        $this->assertFalse($leader->fresh()->isPlus());
        $this->assertTrue($leader->fresh()->subscribed('family:'.$family->id));
        $this->assertNotNull($family->fresh()->toCard()['plus']);

        $this->hook('transaction.completed', $this->transaction('txn_p', 'ctm_01', 'pri_promotop70001', [
            'user_id' => (string) $leader->id, 'server_id' => (string) $server->id, 'product' => 'promo_top_7',
        ]))->assertOk();
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
