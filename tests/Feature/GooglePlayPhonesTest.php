<?php

namespace Tests\Feature;

use App\Models\PhoneNumber;
use App\Models\PlusPayment;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Billing\GooglePlay;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Номери телефону в застосунку через Google Play: бронь → покупка товару phone_<рівень> → сервер
 * перевіряє її в Developer API, вмикає саме заброньований номер і списує покупку (consume).
 */
class GooglePlayPhonesTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, array<string, mixed>> Відповіді purchases.products за токеном. */
    private array $purchases = [];

    /** @var list<string> */
    private array $consumed = [];

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
        app(SiteSettings::class)->put(['google_play_phones_enabled' => true]);

        Http::fake(function (Request $request) {
            if ($request->url() === 'https://oauth.test/token') {
                return Http::response(['access_token' => 'ya29.test', 'expires_in' => 3600]);
            }
            if (preg_match('#/purchases/products/(phone_[a-z]+)/tokens/([^/:]+):consume$#', $request->url(), $m)) {
                $this->consumed[] = rawurldecode($m[2]);

                return Http::response([]);
            }
            if (preg_match('#/purchases/products/(phone_[a-z]+)/tokens/([^/:]+)$#', $request->url(), $m)) {
                $data = $this->purchases[rawurldecode($m[2])] ?? null;

                return $data === null ? Http::response(['error' => ['code' => 404]], 404) : Http::response($data);
            }

            return Http::response([], 500);
        });
    }

    private function token(User $user): string
    {
        return app(ApiTokens::class)->issue($user, 'android');
    }

    /** @param  array<string, mixed>  $hold */
    private function bought(string $token, User $user, array $hold, int $state = 0): void
    {
        $this->purchases[$token] = [
            'kind' => 'androidpublisher#productPurchase',
            'purchaseState' => $state,
            'consumptionState' => 0,
            'orderId' => 'GPA.3333-4444-5555-66666',
            'obfuscatedExternalAccountId' => app(GooglePlay::class)->accountId($user),
            'obfuscatedExternalProfileId' => $hold['profile_id'],
        ];
    }

    public function test_app_buys_a_held_number_through_google_play(): void
    {
        $user = User::factory()->create();
        $api = $this->withToken($this->token($user));

        $api->getJson('/api/v1/google-play')->assertOk()->assertJsonPath('phone_products.3', 'phone_gold')->assertJsonPath('enabled', false);
        // Перевірка й підбір номера — через міст, як на сайті.
        $api->getJson('/api/v1/site/phone/check?operator=05&digits=1777745')->assertOk()->assertJsonPath('tier', 'gold')->assertJsonPath('available', true);

        $hold = $api->postJson('/api/v1/google-play/phone/hold', ['operator' => '05', 'digits' => '1777745'])->assertOk()
            ->assertJsonPath('product', 'phone_gold')->json();
        $this->bought('tok-phone-1', $user, $hold);

        $api->postJson('/api/v1/google-play/phone/verify', ['purchase_token' => 'tok-phone-1', 'product_id' => 'phone_gold', 'amount_micros' => 499_000_000, 'currency' => 'UAH'])
            ->assertOk()->assertJsonPath('phone.tier', 'gold')->assertJsonPath('gift', false);

        $number = PhoneNumber::query()->where('user_id', $user->id)->where('status', PhoneNumber::ACTIVE)->sole();
        $this->assertSame('1777745', $number->digits);
        $this->assertSame(PhoneNumber::PURCHASED, $number->kind);
        $payment = PlusPayment::query()->sole();
        $this->assertSame([49900, 'UAH', 'google_play'], [$payment->amount, $payment->currency, $payment->provider]);
        $this->assertSame(['tok-phone-1'], $this->consumed);

        // Повтор того самого токена не дублює ні платіж, ні номер.
        $api->postJson('/api/v1/google-play/phone/verify', ['purchase_token' => 'tok-phone-1', 'product_id' => 'phone_gold'])->assertOk();
        $this->assertSame(1, PlusPayment::query()->count());

        // Повернення коштів через Google — номер звільняється.
        $data = base64_encode((string) json_encode([
            'version' => '1.0', 'packageName' => 'online.gamecon.app',
            'voidedPurchaseNotification' => ['purchaseToken' => 'tok-phone-1', 'orderId' => 'GPA.3333-4444-5555-66666', 'productType' => 2],
        ]));
        $this->postJson('/billing/google-play/rtdn?token='.app(GooglePlay::class)->rtdnToken(), ['message' => ['data' => $data]])->assertNoContent();
        $this->assertSame(PlusPayment::REFUNDED, $payment->fresh()->status);
        $this->assertNull(PhoneNumber::query()->find($number->id));
    }

    public function test_wrong_account_pending_payment_or_lost_hold_give_no_number(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $api = $this->withToken($this->token($user));
        $hold = $api->postJson('/api/v1/google-play/phone/hold', ['operator' => '05', 'digits' => '1234567'])->assertOk()->json();

        $this->bought('tok-other-acc', $other, $hold);
        $api->postJson('/api/v1/google-play/phone/verify', ['purchase_token' => 'tok-other-acc', 'product_id' => $hold['product']])->assertForbidden();

        $this->bought('tok-pending', $user, $hold, state: 2);
        $api->postJson('/api/v1/google-play/phone/verify', ['purchase_token' => 'tok-pending', 'product_id' => $hold['product']])->assertStatus(422);

        // Бронь зникла — покупку не списуємо, Google поверне гроші сам.
        PhoneNumber::query()->delete();
        $this->bought('tok-late-hold', $user, $hold);
        $api->postJson('/api/v1/google-play/phone/verify', ['purchase_token' => 'tok-late-hold', 'product_id' => $hold['product']])->assertStatus(409);
        $this->assertSame([], $this->consumed);
        $this->assertSame(0, PlusPayment::query()->count());

        app(SiteSettings::class)->put(['google_play_phones_enabled' => false]);
        $api->postJson('/api/v1/google-play/phone/hold', ['operator' => '05', 'digits' => '1234568'])->assertNotFound();
    }
}
