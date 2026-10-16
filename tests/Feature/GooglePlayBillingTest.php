<?php

namespace Tests\Feature;

use App\Models\PlusSubscription;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Billing\GooglePlay;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * GameCon+ у застосунку через Google Play Billing: сервер перевіряє кожен токен у Google Play Developer API,
 * підтверджує покупку й веде доступ; продовження, скасування й повернення — через RTDN і щоденну перевірку.
 */
class GooglePlayBillingTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, array<string, mixed>> Відповіді subscriptionsv2 за токеном. */
    private array $purchases = [];

    /** @var list<string> */
    private array $acknowledged = [];

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.google_play.url' => 'https://play.test', 'app.url' => 'https://gamecon.test']);

        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $pem);
        app(SiteSettings::class)->putSecret('google_play_service_account', (string) json_encode([
            'type' => 'service_account', 'project_id' => 'gamecon-test', 'client_email' => 'play@gamecon-test.iam.gserviceaccount.com',
            'private_key' => $pem, 'token_uri' => 'https://oauth.test/token',
        ]));
        app(SiteSettings::class)->put(['google_play_enabled' => true, 'google_play_products' => 'gamecon_plus']);

        Http::fake(function (Request $request) {
            if ($request->url() === 'https://oauth.test/token') {
                return Http::response(['access_token' => 'ya29.test', 'expires_in' => 3600]);
            }
            if (preg_match('#/applications/online\.gamecon\.app/purchases/subscriptionsv2/tokens/([^/]+)$#', $request->url(), $m)) {
                $data = $this->purchases[rawurldecode($m[1])] ?? null;

                return $data === null ? Http::response(['error' => ['code' => 404]], 404) : Http::response($data);
            }
            if (preg_match('#/purchases/subscriptions/gamecon_plus/tokens/([^/]+):acknowledge$#', $request->url(), $m)) {
                $this->acknowledged[] = rawurldecode($m[1]);
                $this->purchases[rawurldecode($m[1])]['acknowledgementState'] = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';

                return Http::response([]);
            }

            return Http::response([], 500);
        });
    }

    private function purchase(string $token, User $user, string $state = 'SUBSCRIPTION_STATE_ACTIVE', ?string $expiry = null, bool $autoRenew = true, string $product = 'gamecon_plus', bool $acknowledged = false): void
    {
        $this->purchases[$token] = [
            'kind' => 'androidpublisher#subscriptionPurchaseV2',
            'startTime' => now()->subMinute()->toIso8601ZuluString(),
            'subscriptionState' => $state,
            'latestOrderId' => 'GPA.1234-5678-9012-34567',
            'acknowledgementState' => $acknowledged ? 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' : 'ACKNOWLEDGEMENT_STATE_PENDING',
            'externalAccountIdentifiers' => ['obfuscatedExternalAccountId' => app(GooglePlay::class)->accountId($user)],
            'lineItems' => [[
                'productId' => $product,
                'expiryTime' => $expiry ?? now()->addMonth()->toIso8601ZuluString(),
                'autoRenewingPlan' => ['autoRenewEnabled' => $autoRenew],
                'offerDetails' => ['basePlanId' => 'monthly'],
            ]],
        ];
    }

    private function token(User $user): string
    {
        return app(ApiTokens::class)->issue($user, 'android');
    }

    private function rtdn(string $token, int $type = 4): TestResponse
    {
        $data = base64_encode((string) json_encode([
            'version' => '1.0', 'packageName' => 'online.gamecon.app', 'eventTimeMillis' => '1',
            'subscriptionNotification' => ['version' => '1.0', 'notificationType' => $type, 'purchaseToken' => $token, 'subscriptionId' => 'gamecon_plus'],
        ]));

        return $this->postJson('/billing/google-play/rtdn?token='.app(GooglePlay::class)->rtdnToken(), ['message' => ['data' => $data, 'messageId' => '1'], 'subscription' => 'projects/x/subscriptions/y']);
    }

    public function test_app_gets_product_ids_and_account_id_but_no_prices(): void
    {
        $user = User::factory()->create();
        $json = $this->withToken($this->token($user))->getJson('/api/v1/google-play')->assertOk()
            ->assertJsonPath('enabled', true)
            ->assertJsonPath('products', ['gamecon_plus'])
            ->assertJsonPath('account_id', app(GooglePlay::class)->accountId($user))
            ->getContent();
        $this->assertStringNotContainsString('₴', $json);
        $this->assertStringNotContainsString('price', $json);

        app(SiteSettings::class)->put(['google_play_enabled' => false]);
        $this->withToken($this->token($user))->getJson('/api/v1/google-play')->assertOk()->assertExactJson(['enabled' => false, 'products' => [], 'account_id' => null]);
        $this->withToken($this->token($user))->postJson('/api/v1/google-play/verify', ['purchase_token' => 'token-123456'])->assertNotFound();
    }

    public function test_verified_purchase_enables_plus_and_is_acknowledged(): void
    {
        $user = User::factory()->create();
        $this->purchase('tok-active-1', $user);

        $this->withToken($this->token($user))->postJson('/api/v1/google-play/verify', ['purchase_token' => 'tok-active-1', 'product_id' => 'gamecon_plus'])
            ->assertOk()->assertJsonPath('is_pro', true)->assertJsonPath('status', 'active')->assertJsonPath('acknowledged', true);

        $this->assertSame(['tok-active-1'], $this->acknowledged);
        $user->refresh();
        $this->assertTrue($user->isPlus());
        // Із запасом на продовження, поки Google проводить платіж.
        $this->assertTrue($user->plus_until->gt(now()->addMonth()->addDays(2)));
        $sub = PlusSubscription::query()->sole();
        $this->assertSame(PlusSubscription::hashToken('tok-active-1'), $sub->provider_id);
        $this->assertSame('monthly', $sub->base_plan);
        $this->assertTrue($sub->auto_renew);

        // Статус у застосунку: керування підпискою — у Google Play.
        $this->withToken($this->token($user))->getJson('/api/v1/user/subscription-status')->assertOk()
            ->assertJsonPath('is_pro', true)->assertJsonPath('store', 'google_play')
            ->assertJsonPath('manage_url', 'https://play.google.com/store/account/subscriptions?sku=gamecon_plus&package=online.gamecon.app');

        // Повторна перевірка не створює дублів і не підтверджує вдруге.
        $this->withToken($this->token($user))->postJson('/api/v1/google-play/verify', ['purchase_token' => 'tok-active-1'])->assertOk();
        $this->assertSame(1, PlusSubscription::query()->count());
        $this->assertCount(1, $this->acknowledged);
    }

    public function test_purchase_of_another_account_or_unknown_product_is_rejected(): void
    {
        $owner = User::factory()->create();
        $thief = User::factory()->create();
        $this->purchase('tok-owner-purchase', $owner);
        $this->purchase('tok-other-product', $thief, product: 'coins_100');

        $this->withToken($this->token($thief))->postJson('/api/v1/google-play/verify', ['purchase_token' => 'tok-owner-purchase'])->assertForbidden();
        $this->withToken($this->token($thief))->postJson('/api/v1/google-play/verify', ['purchase_token' => 'tok-other-product'])->assertUnprocessable();
        $this->withToken($this->token($thief))->postJson('/api/v1/google-play/verify', ['purchase_token' => 'tok-unknown-x'])->assertUnprocessable();

        // Підроблений ID акаунта не приймається.
        $this->assertNull(app(GooglePlay::class)->userFromAccountId('u'.$owner->id.'.000000000000000000000000'));
        $this->assertFalse($thief->fresh()->isPlus());
        $this->assertSame([], $this->acknowledged);
    }

    public function test_rtdn_cancel_keeps_access_until_expiry_and_expiry_removes_it(): void
    {
        $user = User::factory()->create();
        $this->purchase('tok-rtdn', $user);
        $this->rtdn('tok-rtdn', 4)->assertNoContent();
        $this->assertTrue($user->fresh()->isPlus());

        // Скасовано в Google Play: доступ до кінця оплаченого періоду, без запасу.
        $expiry = now()->addDays(10)->startOfSecond();
        $this->purchase('tok-rtdn', $user, 'SUBSCRIPTION_STATE_CANCELED', $expiry->toIso8601ZuluString(), autoRenew: false, acknowledged: true);
        $this->rtdn('tok-rtdn', 3)->assertNoContent();
        $this->assertTrue($user->fresh()->plus_until->equalTo($expiry));
        $this->assertSame('canceled', PlusSubscription::query()->sole()->status);

        // Строк минув.
        $this->purchase('tok-rtdn', $user, 'SUBSCRIPTION_STATE_EXPIRED', now()->subMinute()->toIso8601ZuluString(), autoRenew: false, acknowledged: true);
        $this->rtdn('tok-rtdn', 13)->assertNoContent();
        $this->assertFalse($user->fresh()->isPlus());

        // Чужий секрет — відмова; невідомий токен — не повторювати.
        $this->postJson('/billing/google-play/rtdn?token=wrong', ['message' => ['data' => 'x']])->assertForbidden();
        $this->rtdn('tok-never-seen')->assertNoContent();
    }

    public function test_voided_purchase_revokes_access_and_tick_rechecks_expiring(): void
    {
        $user = User::factory()->create();
        $this->purchase('tok-void', $user);
        app(GooglePlay::class)->sync('tok-void', $user);
        $this->assertTrue($user->fresh()->isPlus());

        $data = base64_encode((string) json_encode(['packageName' => 'online.gamecon.app', 'voidedPurchaseNotification' => ['purchaseToken' => 'tok-void', 'orderId' => 'GPA.1', 'productType' => 1]]));
        $this->postJson('/billing/google-play/rtdn?token='.app(GooglePlay::class)->rtdnToken(), ['message' => ['data' => $data]])->assertNoContent();
        $this->assertFalse($user->fresh()->isPlus());

        // Продовження без сповіщення: щоденна перевірка перечитує підписки, що закінчуються.
        $other = User::factory()->create();
        $this->purchase('tok-tick', $other, expiry: now()->addHours(2)->toIso8601ZuluString(), acknowledged: true);
        app(GooglePlay::class)->sync('tok-tick', $other);
        PlusSubscription::query()->where('user_id', $other->id)->update(['checked_at' => now()->subDay()]);
        $this->purchase('tok-tick', $other, expiry: now()->addMonth()->toIso8601ZuluString(), acknowledged: true);
        $this->artisan('billing:tick')->assertSuccessful();
        $this->assertTrue($other->fresh()->plus_until->gt(now()->addDays(29)));
    }

    public function test_admin_integration_block_and_secrets_stay_hidden(): void
    {
        $admin = User::factory()->admin()->create();
        $page = $this->actingAs($admin)->get('/admin/integrations')->assertOk();
        $html = $page->getContent();
        $this->assertStringContainsString('google_play', $html);
        $this->assertStringNotContainsString('BEGIN PRIVATE KEY', $html);
        $this->assertArrayNotHasKey('google_play_service_account', app(SiteSettings::class)->public());
    }
}
