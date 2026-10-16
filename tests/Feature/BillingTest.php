<?php

namespace Tests\Feature;

use App\Models\PaymentCard;
use App\Models\PaymentOrder;
use App\Models\PlusCode;
use App\Models\PlusPayment;
use App\Models\PlusRenewal;
use App\Models\User;
use App\Notifications\BillingNotice;
use App\Notifications\PlusGifted;
use App\Services\Billing\Catalog;
use App\Services\Billing\Wallet;
use App\Services\Plus\Plus;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Оплата карткою через monobank: замовлення, вебхук з підписом, збережена картка, автопродовження, промокоди, адмінка. */
class BillingTest extends TestCase
{
    use RefreshDatabase;

    private const API = 'https://mono.test';

    /** @var \OpenSSLAsymmetricKey */
    private $key;

    /** @var list<array<string, mixed>> */
    private array $walletResults = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        config(['services.monobank_acquiring.url' => self::API, 'app.url' => 'https://gamecon.online']);
        app(SiteSettings::class)->putSecret('monobank_acquiring_token', 'test-token-0123456789abcdef');
        $this->key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        $pem = openssl_pkey_get_details($this->key)['key'];

        Http::fake(function (HttpRequest $r) use ($pem) {
            $path = parse_url($r->url(), PHP_URL_PATH);

            return match ($path) {
                '/api/merchant/pubkey' => Http::response(['key' => base64_encode($pem)]),
                '/api/merchant/invoice/create' => Http::response(['invoiceId' => 'inv-'.substr(md5($r->body()), 0, 8), 'pageUrl' => 'https://pay.mbnk.biz/p1']),
                '/api/merchant/invoice/status' => Http::response(['invoiceId' => $r['invoiceId'], 'status' => 'success', 'amount' => 14900, 'ccy' => 980, 'modifiedDate' => now()->toIso8601String()]),
                '/api/merchant/invoice/cancel' => Http::response(['status' => 'processing']),
                '/api/merchant/wallet/payment' => Http::response(array_shift($this->walletResults) ?? ['invoiceId' => 'inv-w', 'status' => 'success']),
                default => Http::response([], 404),
            };
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function webhook(array $payload): TestResponse
    {
        $body = json_encode($payload);
        openssl_sign($body, $signature, $this->key, OPENSSL_ALGO_SHA256);

        return $this->call('POST', '/billing/monobank/webhook', [], [], [], ['HTTP_X_SIGN' => base64_encode($signature), 'CONTENT_TYPE' => 'application/json'], $body);
    }

    private function buy(User $user, array $body): PaymentOrder
    {
        $response = $this->actingAs($user)->postJson('/plus/billing/purchase', $body)->assertOk();

        return PaymentOrder::query()->findOrFail($response->json('order.id'));
    }

    public function test_card_purchase_goes_through_monobank_and_webhook_turns_it_on(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/plus/billing/purchase', ['product' => 'plus_month', 'renew' => true, 'save_card' => true])
            ->assertOk()->assertJsonPath('redirect', 'https://pay.mbnk.biz/p1');
        $order = PaymentOrder::query()->findOrFail($response->json('order.id'));
        $this->assertSame(14900, $order->amount);
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/invoice/create')
            && $r->header('X-Token')[0] === 'test-token-0123456789abcdef'
            && $r['amount'] === 14900 && $r['ccy'] === 980
            && $r['saveCardData']['walletId'] === 'gc-user-'.$user->id
            && $r['webHookUrl'] === 'https://gamecon.online/billing/monobank/webhook'
            && $r['merchantPaymInfo']['reference'] === $order->code);

        // Підроблений вебхук не проходить.
        $this->call('POST', '/billing/monobank/webhook', [], [], [], ['HTTP_X_SIGN' => base64_encode('nope')], json_encode(['invoiceId' => $order->invoice_id, 'status' => 'success']))->assertStatus(400);
        $this->assertSame(PaymentOrder::PENDING, $order->fresh()->status);

        $payload = [
            'invoiceId' => $order->invoice_id, 'status' => 'success', 'amount' => 14900, 'ccy' => 980, 'modifiedDate' => '2026-10-16T10:00:00Z',
            'paymentInfo' => ['maskedPan' => '444403******1902', 'paymentSystem' => 'visa'],
            'walletData' => ['cardToken' => 'card-token-1', 'walletId' => 'gc-user-'.$user->id, 'status' => 'created'],
        ];
        $this->webhook($payload)->assertOk();
        $this->webhook($payload)->assertOk(); // повтор банку — без подвійної видачі

        $order->refresh();
        $this->assertSame(PaymentOrder::PAID, $order->status);
        $this->assertTrue($user->fresh()->isPlus());
        $this->assertSame(1, PlusPayment::query()->where('provider', 'monobank')->count());
        $card = PaymentCard::query()->sole();
        $this->assertSame('444403******1902', $card->masked_pan);
        $this->assertSame('card-token-1', $card->token);
        $this->assertNotSame('card-token-1', $card->getRawOriginal('token')); // токен зашифровано
        $renewal = PlusRenewal::query()->sole();
        $this->assertTrue($renewal->active);
        $this->assertSame($card->id, $renewal->card_id);
        Notification::assertSentTo($user, BillingNotice::class);

        $this->actingAs($user)->get('/plus/billing')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('plus/billing')->has('orders', 1)->has('cards', 1)->where('renewals.0.active', true));
    }

    public function test_returning_from_the_payment_page_checks_the_status_when_the_webhook_is_late(): void
    {
        $user = User::factory()->create();
        $order = $this->buy($user, ['product' => 'plus_month']);

        $this->actingAs($user)->get("/plus/billing/orders/{$order->id}/return")->assertRedirect('/plus/billing?order='.$order->id);
        $this->assertSame(PaymentOrder::PAID, $order->fresh()->status);
        $this->assertTrue($user->fresh()->isPlus());
    }

    public function test_auto_renewal_charges_the_saved_card_and_retries_with_limits(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $card = PaymentCard::query()->create(['user_id' => $user->id, 'token' => 'tok-1', 'token_hash' => hash('sha256', 'tok-1'), 'masked_pan' => '5375****1111']);
        app(Plus::class)->grant($user, 1, 'purchase');
        PlusRenewal::query()->create(['user_id' => $user->id, 'product' => 'plus_month', 'owner_type' => 'user', 'owner_id' => $user->id, 'active' => true, 'card_id' => $card->id]);
        $until = $user->fresh()->plus_until;

        $this->walletResults = [['invoiceId' => 'inv-r1', 'status' => 'success', 'paymentInfo' => ['maskedPan' => '5375****1111']]];
        Artisan::call('billing:tick');

        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/wallet/payment') && $r['cardToken'] === 'tok-1' && $r['initiationKind'] === 'merchant' && $r['amount'] === 14900);
        $this->assertTrue($user->fresh()->plus_until->gt($until->addDays(29)));
        $this->assertSame(PaymentOrder::PAID, PaymentOrder::query()->where('kind', 'renewal')->sole()->status);

        // Наступного разу банк відмовляє: спроба фіксується, повтор — не раніше retry_hours, не більше retry_max.
        $this->travel(31)->days();
        $this->walletResults = [['invoiceId' => 'inv-r2', 'status' => 'failure', 'failureReason' => 'Недостатньо коштів']];
        Artisan::call('billing:tick');
        $renewal = PlusRenewal::query()->sole();
        $this->assertSame(1, $renewal->attempts);
        Notification::assertSentTo($user, BillingNotice::class, fn (BillingNotice $n) => $n->kind === 'plus_renewal_failed' && str_contains($n->text, 'Недостатньо коштів'));

        Artisan::call('billing:tick'); // одразу — без нової спроби
        $this->assertSame(2, PaymentOrder::query()->where('kind', 'renewal')->count());
    }

    public function test_gift_to_a_friend_is_paid_by_card(): void
    {
        Notification::fake();
        $payer = User::factory()->create();
        $friend = User::factory()->create(['username' => 'friend']);
        $order = $this->buy($payer, ['product' => 'gift_month', 'username' => 'friend']);
        $this->webhook(['invoiceId' => $order->invoice_id, 'status' => 'success', 'modifiedDate' => '2026-10-16T10:00:00Z'])->assertOk();

        $this->assertTrue($friend->fresh()->isPlus());
        $this->assertFalse($payer->fresh()->isPlus());
        Notification::assertSentTo($friend, PlusGifted::class);
    }

    public function test_leftover_balance_is_counted_into_the_price(): void
    {
        $user = User::factory()->create();
        app(Wallet::class)->credit($user, 5000, 'topup', 'Старий баланс');
        $order = $this->buy($user, ['product' => 'plus_month']);
        $this->assertSame(5000, $order->credit_used);
        $this->assertSame(9900, $order->amount);

        $this->webhook(['invoiceId' => $order->invoice_id, 'status' => 'success', 'modifiedDate' => '2026-10-16T10:00:00Z'])->assertOk();
        $this->assertSame(0, $user->fresh()->balance);
    }

    public function test_promo_codes_of_every_type(): void
    {
        $user = User::factory()->create();

        // Дні GameCon+ одразу.
        PlusCode::query()->create(['code' => 'DAYS7', 'type' => 'days', 'days' => 7, 'max_uses' => 5]);
        $this->actingAs($user)->post('/plus/redeem', ['code' => 'days7'])->assertRedirect();
        $this->assertTrue($user->fresh()->isPlus());

        // Знижка 50% на дві оплати.
        PlusCode::query()->create(['code' => 'HALF', 'type' => 'discount', 'percent' => 50, 'payments' => 2, 'max_uses' => 5]);
        $this->actingAs($user)->postJson('/plus/billing/promo', ['code' => 'HALF', 'product' => 'plus_month'])->assertOk()->assertJsonPath('discount', 7450);
        $this->actingAs($user)->getJson('/plus/billing/quote?product=plus_month')->assertJsonPath('amount', 7450);
        $first = $this->buy($user, ['product' => 'plus_month']);
        $this->assertSame(7450, $first->amount);
        $this->webhook(['invoiceId' => $first->invoice_id, 'status' => 'success', 'modifiedDate' => '2026-10-16T10:00:00Z']);
        $second = $this->buy($user, ['product' => 'plus_year']);
        $this->assertSame(64500, $second->amount);
        $this->webhook(['invoiceId' => $second->invoice_id, 'status' => 'success', 'modifiedDate' => '2026-10-16T10:01:00Z']);
        $this->assertSame(14900, $this->buy($user, ['product' => 'plus_month'])->amount); // знижку вичерпано

        // Перший платіж зі знижкою 100 ₴, лише для нових.
        PlusCode::query()->create(['code' => 'NEW100', 'type' => 'first_payment', 'amount_off' => 100, 'new_only' => true, 'max_uses' => 5]);
        $this->actingAs($user)->postJson('/plus/billing/promo', ['code' => 'NEW100', 'product' => 'plus_month'])->assertStatus(422);
        $newbie = User::factory()->create();
        $this->actingAs($newbie)->postJson('/plus/billing/promo', ['code' => 'NEW100', 'product' => 'plus_month'])->assertOk()->assertJsonPath('discount', 10000);

        // Безкоштовний місяць, далі — підписка.
        PlusCode::query()->create(['code' => 'TRY', 'type' => 'trial', 'months' => 1, 'max_uses' => 5]);
        $trial = User::factory()->create();
        $this->actingAs($trial)->post('/plus/redeem', ['code' => 'TRY', 'product' => 'plus_month'])->assertRedirect();
        $this->assertTrue($trial->fresh()->plus_until->gt(now()->addDays(29)));
        $this->assertTrue(PlusRenewal::query()->where('owner_id', $trial->id)->where('owner_type', 'user')->sole()->active);
    }

    public function test_admin_edits_plans_rules_google_pay_and_refunds_to_card(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();

        $plans = collect(app(Catalog::class)->products())->map(fn (array $p) => [
            'key' => $p['key'], 'kind' => $p['kind'], 'promo' => $p['promo'], 'name' => $p['name'], 'price' => $p['key'] === 'plus_month' ? 99 : $p['price'],
            'old_price' => $p['key'] === 'plus_month' ? 149 : null, 'days' => $p['days'], 'recurring' => true, 'enabled' => $p['key'] !== 'gift_year', 'badge' => null,
        ])->values()->push(['key' => 'plus_quarter', 'kind' => 'plus', 'promo' => null, 'name' => 'GameCon+ · 3 місяці', 'price' => 399, 'old_price' => null, 'days' => 90, 'recurring' => true, 'enabled' => true, 'badge' => 'Вигідно'])->all();
        $this->actingAs($admin)->put('/admin/billing/products', ['products' => $plans])->assertSessionHasNoErrors();
        $this->actingAs($admin)->put('/admin/billing/rules', ['renew_before_hours' => 48, 'retry_hours' => 12, 'retry_max' => 4, 'order_hours' => 2, 'card_renewals' => true, 'offer_save_card' => true, 'badges' => ['visa', 'mastercard', 'prostir']])->assertSessionHasNoErrors();
        $this->actingAs($admin)->put('/admin/billing/google-pay', ['enabled' => true, 'environment' => 'TEST', 'merchant_name' => 'GameCon', 'gateway' => 'monobank', 'gateway_merchant_id' => 'mono-123'])->assertSessionHasNoErrors();

        $this->actingAs($user)->get('/plus/billing')->assertInertia(fn (Assert $page) => $page
            ->where('billing.products.plus_month.price', 99)
            ->where('billing.products.plus_month.old_price', 149)
            ->where('billing.products.gift_year.available', false)
            ->where('billing.products.plus_quarter.days', 90)
            ->where('billing.badges', ['visa', 'mastercard', 'prostir'])
            ->where('billing.google_pay.gateway_merchant_id', 'mono-123'));

        $order = $this->buy($user, ['product' => 'plus_quarter', 'renew' => true]);
        $this->assertSame(39900, $order->amount);
        $this->webhook(['invoiceId' => $order->invoice_id, 'status' => 'success', 'modifiedDate' => '2026-10-16T10:00:00Z']);
        $this->assertTrue($user->fresh()->isPlus());

        $this->actingAs($admin)->post("/admin/billing/orders/{$order->id}/refund")->assertSessionHasNoErrors();
        Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/invoice/cancel') && $r['invoiceId'] === $order->invoice_id && $r['amount'] === 39900);
        $this->assertSame(PaymentOrder::REFUNDED, $order->fresh()->status);
        $this->assertFalse($user->fresh()->isPlus());
    }
}
