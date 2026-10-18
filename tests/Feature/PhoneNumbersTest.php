<?php

namespace Tests\Feature;

use App\Models\PaymentOrder;
use App\Models\PhoneNumber;
use App\Models\PhoneNumberRule;
use App\Models\PlusPayment;
use App\Models\User;
use App\Services\Billing\Shop;
use App\Services\Phones\PhoneNumbers;
use App\Services\Phones\PhoneTiers;
use App\Support\Settings\SiteSettings;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Внутрішні номери: рівні, без дублікатів, випадковий раз на тиждень, покупка через monobank, приватність, адмінка. */
class PhoneNumbersTest extends TestCase
{
    use RefreshDatabase;

    private const API = 'https://mono.test';

    /** @var \OpenSSLAsymmetricKey */
    private $key;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        config(['services.monobank_acquiring.url' => self::API, 'app.url' => 'https://gamecon.online']);
        app(SiteSettings::class)->putSecret('monobank_acquiring_token', 'test-token-0123456789abcdef');
        $this->key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        $pem = openssl_pkey_get_details($this->key)['key'];
        Http::fake(fn (HttpRequest $r) => match (parse_url($r->url(), PHP_URL_PATH)) {
            '/api/merchant/pubkey' => Http::response(['key' => base64_encode($pem)]),
            '/api/merchant/invoice/create' => Http::response(['invoiceId' => 'inv-'.substr(md5($r->body()), 0, 8), 'pageUrl' => 'https://pay.mbnk.biz/p1']),
            '/api/merchant/invoice/cancel' => Http::response(['status' => 'processing']),
            default => Http::response([], 404),
        });
    }

    private function paid(PaymentOrder $order): void
    {
        $body = (string) json_encode(['invoiceId' => $order->invoice_id, 'status' => 'success', 'modifiedDate' => now()->toIso8601String()]);
        openssl_sign($body, $signature, $this->key, OPENSSL_ALGO_SHA256);
        $this->call('POST', '/billing/monobank/webhook', [], [], [], ['HTTP_X_SIGN' => base64_encode($signature), 'CONTENT_TYPE' => 'application/json'], $body)->assertOk();
    }

    public function test_tiers_follow_the_digits(): void
    {
        $this->assertSame('diamond', PhoneTiers::detect('77', '7777777'));
        $this->assertSame('platinum', PhoneTiers::detect('05', '7777777'));
        $this->assertSame('platinum', PhoneTiers::detect('05', '1666666'));
        $this->assertSame('gold', PhoneTiers::detect('05', '1234567'));
        $this->assertSame('gold', PhoneTiers::detect('05', '1288889'));
        $this->assertSame('silver', PhoneTiers::detect('05', '1232323'));
        $this->assertSame('silver', PhoneTiers::detect('05', '1234321'));
        $this->assertSame('bronze', PhoneTiers::detect('05', '1284545'));
        $this->assertSame('bronze', PhoneTiers::detect('05', '1555829'));
        $this->assertSame('regular', PhoneTiers::detect('05', '1928374'));

        // Генератор видає номер саме того рівня.
        foreach (PhoneTiers::ALL as $tier) {
            for ($i = 0; $i < 20; $i++) {
                [$op, $digits] = PhoneTiers::generate($tier);
                if (PhoneTiers::detect($op, $digits) === $tier) {
                    continue 2;
                }
            }
            $this->fail("Generator never produced a {$tier} number");
        }
    }

    public function test_random_number_is_free_unique_and_changes_once_a_week(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/phone/random')->assertOk()->assertJsonPath('phone.kind', 'random');
        $number = PhoneNumber::query()->where('user_id', $user->id)->sole();
        $this->assertSame('555', $number->country);
        $this->assertMatchesRegularExpression('/^\+555 \(\d{2}\) \d{3}-\d{2}-\d{2}$/', $number->formatted());

        // Друга зміна протягом тижня — ні; через тиждень — так, старий номер звільняється.
        $this->actingAs($user)->postJson('/phone/random')->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->travel(8)->days();
        $this->actingAs($user)->postJson('/phone/random')->assertOk();
        $this->assertSame(1, PhoneNumber::query()->where('user_id', $user->id)->count());
        $this->assertNull(PhoneNumber::query()->find($number->id));
    }

    public function test_chances_can_give_a_rare_number_for_free(): void
    {
        app(SiteSettings::class)->put([PhoneNumbers::SETTING => ['chances' => ['bronze' => 0, 'silver' => 0, 'gold' => 0, 'platinum' => 0, 'diamond' => 100]]]);
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/phone/random')->assertOk()->assertJsonPath('phone.tier', 'diamond');
        $number = PhoneNumber::query()->sole();
        $this->assertSame(str_repeat($number->digits[0], 2), $number->operator);
    }

    public function test_numbers_have_no_duplicates_across_both_networks(): void
    {
        $owner = User::factory()->create();
        PhoneNumber::query()->create(['user_id' => $owner->id, 'country' => '555', 'operator' => '05', 'digits' => '1928374', 'tier' => 'regular', 'kind' => 'random']);
        $buyer = User::factory()->create();

        // Той самий номер у мережі +777 — зайнятий.
        $this->actingAs($buyer)->getJson('/phone/check?operator=05&digits=1928374')->assertOk()
            ->assertJsonPath('available', false)->assertJsonPath('reason', 'Номер уже зайнятий.');
        $this->actingAs($owner)->getJson('/phone/check?operator=05&digits=1928374')->assertJsonPath('reason', 'Це вже ваш номер.');
        $this->actingAs($buyer)->postJson('/plus/billing/purchase', ['product' => 'phone_regular', 'phone_operator' => '05', 'phone_digits' => '1928374'])
            ->assertUnprocessable();

        // Навіть в обхід перевірок база не прийме дубль.
        $this->expectException(UniqueConstraintViolationException::class);
        PhoneNumber::query()->create(['user_id' => $buyer->id, 'country' => '777', 'operator' => '05', 'digits' => '1928374', 'tier' => 'regular', 'kind' => 'purchased']);
    }

    public function test_buying_a_number_by_card_with_plus_discount(): void
    {
        $buyer = User::factory()->create(['plus_until' => now()->addMonth()]);
        $this->actingAs($buyer)->postJson('/phone/random')->assertOk();

        $check = $this->actingAs($buyer)->getJson('/phone/check?operator=77&digits=1234567')->assertOk()->json();
        $this->assertSame('gold', $check['tier']);
        $this->assertSame(19900, $check['full_price']);
        $this->assertSame(15900, $check['price']); // −20% для GameCon+

        $response = $this->actingAs($buyer)->postJson('/plus/billing/purchase', ['product' => 'phone_gold', 'phone_operator' => '77', 'phone_digits' => '1234567'])->assertOk();
        $order = PaymentOrder::query()->findOrFail($response->json('order.id'));
        $this->assertSame(15900, $order->amount);

        // Поки триває оплата, номер ніхто інший не візьме.
        $this->actingAs(User::factory()->create())->getJson('/phone/check?operator=77&digits=1234567')->assertJsonPath('available', false);

        $this->paid($order);
        $number = app(PhoneNumbers::class)->current($buyer);
        $this->assertSame('+777 (77) 123-45-67', $number?->formatted());
        $this->assertSame('purchased', $number->kind);
        $this->assertSame(1, PhoneNumber::query()->where('user_id', $buyer->id)->count());

        // Куплений номер на випадковий не міняється.
        $this->travel(8)->days();
        $this->actingAs($buyer)->postJson('/phone/random')->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->assertSame('purchased', app(PhoneNumbers::class)->current($buyer)?->kind);

        // Купити ще один можна будь-коли, без тижневого обмеження.
        $this->actingAs($buyer)->postJson('/plus/billing/purchase', ['product' => 'phone_regular', 'phone_operator' => '12', 'phone_digits' => '9182736'])->assertOk();

        // Повернення коштів — номер звільняється.
        app(Shop::class)->refund(PlusPayment::query()->findOrFail($number->payment_id), null);
        $this->assertNull(app(PhoneNumbers::class)->current($buyer));
    }

    public function test_wrong_price_level_or_cancelled_order_releases_the_number(): void
    {
        $buyer = User::factory()->create();
        $this->actingAs($buyer)->postJson('/plus/billing/purchase', ['product' => 'phone_regular', 'phone_operator' => '77', 'phone_digits' => '7777777'])
            ->assertUnprocessable();
        $response = $this->actingAs($buyer)->postJson('/plus/billing/purchase', ['product' => 'phone_diamond', 'phone_operator' => '77', 'phone_digits' => '7777777'])->assertOk();
        $this->actingAs($buyer)->deleteJson('/plus/billing/orders/'.$response->json('order.id'))->assertOk();
        $this->assertSame(0, PhoneNumber::query()->count());
    }

    public function test_dialer_respects_privacy_and_profile_shows_the_number(): void
    {
        $owner = User::factory()->create();
        $caller = User::factory()->create();
        PhoneNumber::query()->create(['user_id' => $owner->id, 'country' => '777', 'operator' => '05', 'digits' => '1234567', 'tier' => 'gold', 'kind' => 'purchased']);

        $this->actingAs($caller)->getJson('/phone/lookup?number='.urlencode('+777 (05) 123-45-67'))->assertJsonPath('found', true)->assertJsonPath('user.id', $owner->id);
        // Без коду мережі — теж знаходиться (номер унікальний).
        $this->actingAs($caller)->getJson('/phone/lookup?number=051234567')->assertJsonPath('found', true);
        $this->actingAs($caller)->postJson('/phone/dial', ['number' => '051234567'])->assertOk()->assertJsonStructure(['conversation' => ['id', 'title']]);
        $this->actingAs($caller)->get('/'.$owner->username)->assertInertia(fn (Assert $page) => $page
            ->where('profile.phone.number', '+777 (05) 123-45-67')->where('profile.phone.tier', 'gold')->where('profile.phone.can_call', true));

        $this->actingAs($owner)->put('/phone/settings', ['privacy' => 'nobody', 'visible' => false])->assertSessionHasNoErrors();
        $this->actingAs($caller)->getJson('/phone/lookup?number=051234567')->assertJsonPath('found', false);
        $this->actingAs($caller)->postJson('/phone/dial', ['number' => '051234567'])->assertForbidden();
        $this->actingAs($caller)->get('/'.$owner->username)->assertInertia(fn (Assert $page) => $page->where('profile.phone', null));
    }

    public function test_onboarding_and_prompt_for_existing_accounts(): void
    {
        $fresh = User::factory()->create();
        $fresh->mergePref(['onboarded' => false]);
        // Реєстрація → номер → режим → далі.
        $this->actingAs($fresh)->get('/start')->assertRedirect('/start/phone');
        $this->actingAs($fresh)->get('/start/phone')->assertInertia(fn (Assert $page) => $page->component('start/phone')->where('codes.random', '555'));
        $this->actingAs($fresh)->postJson('/phone/random')->assertOk();
        $this->actingAs($fresh)->post('/start/phone')->assertRedirect('/start/mode');
        $this->actingAs($fresh)->get('/start')->assertRedirect('/start/mode');

        $old = User::factory()->create();
        $this->actingAs($old)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('phonePrompt', true));
        $this->actingAs($old)->postJson('/phone/dismiss')->assertOk();
        $this->actingAs($old)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('phonePrompt', false));
    }

    public function test_admin_settings_rules_and_taking_numbers_away(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs(User::factory()->create())->get('/admin/phones')->assertForbidden();
        $this->actingAs($admin)->get('/admin/phones')->assertInertia(fn (Assert $page) => $page->component('admin/phones')->where('config.premium_code', '777'));

        $payload = ['premium_code' => '777', 'random_code' => '555', 'plus_discount' => 30, 'random_cooldown_days' => 3, 'chances' => ['bronze' => 60, 'silver' => 30, 'gold' => 20, 'platinum' => 0, 'diamond' => 0]];
        $this->actingAs($admin)->put('/admin/phones', $payload)->assertSessionHasErrors('chances');
        $this->actingAs($admin)->put('/admin/phones', [...$payload, 'random_code' => '777'])->assertSessionHasErrors('random_code');
        $this->actingAs($admin)->put('/admin/phones', [...$payload, 'chances' => ['bronze' => 10, 'silver' => 1, 'gold' => 0.5, 'platinum' => 0, 'diamond' => 0]])->assertSessionHasNoErrors();
        $this->assertSame(30, app(PhoneNumbers::class)->config()['plus_discount']);

        // Резерв і правка рівня.
        $this->actingAs($admin)->post('/admin/phones/rules', ['number' => '05 111-22-33', 'reserved' => true])->assertSessionHasNoErrors();
        $this->actingAs($admin)->getJson('/phone/check?operator=05&digits=1112233')->assertJsonPath('available', false)->assertJsonPath('reason', 'Номер зарезервовано.');
        $this->actingAs($admin)->post('/admin/phones/rules', ['number' => '+777 (06) 192-83-74', 'tier' => 'platinum'])->assertSessionHasNoErrors();
        $this->actingAs($admin)->getJson('/phone/check?operator=06&digits=1928374')->assertJsonPath('tier', 'platinum');
        $this->assertSame(2, PhoneNumberRule::query()->count());

        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/phone/random')->assertOk();
        $number = PhoneNumber::query()->sole();
        $this->actingAs($admin)->delete('/admin/phones/numbers/'.$number->id)->assertRedirect();
        $this->assertSame(0, PhoneNumber::query()->count());
    }
}
