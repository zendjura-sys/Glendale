<?php

namespace Tests\Feature;

use App\Models\PlusDonation;
use App\Models\PlusPayment;
use App\Models\PlusRenewal;
use App\Models\User;
use App\Models\WalletTopup;
use App\Notifications\BillingNotice;
use App\Notifications\PlusGifted;
use App\Services\Billing\InsufficientFunds;
use App\Services\Billing\TopUps;
use App\Services\Billing\Wallet;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Білінг: рахунок, поповнення донатом, покупки з рахунку, автопродовження, повернення, адмінка. */
class BillingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        config(['services.donatello.url' => 'https://donatello.test/api/v1']);
        app(SiteSettings::class)->put(['plus_methods' => [
            'donatello' => ['enabled' => true, 'url' => 'https://donatello.to/gamecon'],
            'diaka' => ['enabled' => true, 'url' => 'https://diaka.ua/gamecon'],
            'patreon' => ['enabled' => false, 'url' => 'https://patreon.com/gamecon'],
        ]]);
    }

    private function fund(User $user, int $uah): void
    {
        app(Wallet::class)->credit($user, $uah * 100, 'topup', 'Тест');
    }

    public function test_billing_page_lives_inside_gameconplus_and_lists_enabled_methods(): void
    {
        $user = User::factory()->create();
        $this->get('/plus/billing')->assertRedirect('/login');

        $this->actingAs($user)->get('/plus/billing')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('plus/billing')
            ->where('balance', 0)
            ->where('methods', fn ($methods) => collect($methods)->pluck('key')->all() === ['donatello', 'diaka'])
            ->has('renewals', 1));

        // Баланс приходить у спільних даних лише власнику й не потрапляє в публічні картки.
        $this->assertArrayNotHasKey('balance', $user->toArray());
    }

    public function test_topup_with_code_is_confirmed_by_admin_and_credits_the_wallet(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $admin = User::factory()->admin()->create();

        $topup = $this->actingAs($user)->postJson('/plus/billing/topups', ['amount' => 200])->assertOk()->json('topup');
        $this->assertMatchesRegularExpression('/^GC-[A-HJ-NP-Z2-9]{6}$/', $topup['code']);
        $this->actingAs($user)->postJson('/plus/billing/topups', ['amount' => 5])->assertStatus(422);

        $this->actingAs($user)->postJson("/plus/billing/topups/{$topup['id']}/claim", ['method' => 'diaka', 'note' => 'Taras 14:05'])
            ->assertOk()->assertJsonPath('topup.claimed', true);

        // Чужу заявку не видно.
        $other = User::factory()->create();
        $this->actingAs($other)->getJson("/plus/billing/topups/{$topup['id']}")->assertNotFound();

        $this->actingAs($admin)->get('/admin/billing')->assertInertia(fn (Assert $page) => $page
            ->component('admin/billing')
            ->where('stats.claimed', 1)
            ->where('pending.0.note', 'Taras 14:05'));

        // Прийшло трохи більше — зараховуємо фактичну суму.
        $this->actingAs($admin)->post("/admin/billing/topups/{$topup['id']}/confirm", ['amount' => '210'])->assertRedirect();
        $this->assertSame(21000, $user->fresh()->balance);
        $this->assertSame(WalletTopup::PAID, WalletTopup::query()->find($topup['id'])->status);
        $this->assertDatabaseHas('wallet_transactions', ['user_id' => $user->id, 'type' => 'topup', 'amount' => 21000, 'balance_after' => 21000, 'by_user_id' => $admin->id]);
        Notification::assertSentTo($user, BillingNotice::class, fn (BillingNotice $n) => $n->kind === 'wallet_topup');

        // Повторне зарахування нічого не змінює.
        $this->actingAs($admin)->post("/admin/billing/topups/{$topup['id']}/confirm")->assertRedirect();
        $this->assertSame(21000, $user->fresh()->balance);
    }

    public function test_donatello_donation_with_code_is_credited_automatically(): void
    {
        app(SiteSettings::class)->putSecret('donatello_token', 'dntl_test_token_123');
        $user = User::factory()->create();
        $topup = app(TopUps::class)->create($user, 149);

        Http::fake([
            'donatello.test/api/v1/donates*' => Http::response(['content' => [
                ['pubId' => 'D1', 'clientName' => 'Olena', 'message' => 'дякую! '.strtolower($topup->code), 'amount' => 150, 'currency' => 'UAH', 'createdAt' => '2026-10-13 12:00:00'],
                ['pubId' => 'D2', 'clientName' => 'Anon', 'message' => 'просто так', 'amount' => 50, 'currency' => 'UAH', 'createdAt' => '2026-10-13 12:01:00'],
            ]]),
        ]);

        Artisan::call('billing:donations');
        Http::assertSent(fn (HttpRequest $r) => $r->hasHeader('X-Token', 'dntl_test_token_123'));

        $this->assertSame(15000, $user->fresh()->balance);
        $this->assertSame(WalletTopup::PAID, $topup->fresh()->status);
        $this->assertSame('donatello', $topup->fresh()->method);
        // Донат без коду чекає ручної прив’язки; повторний запуск нічого не дублює.
        $this->assertSame(1, PlusDonation::query()->whereNull('topup_id')->count());
        Artisan::call('billing:donations');
        $this->assertSame(15000, $user->fresh()->balance);
        $this->assertSame(2, PlusDonation::query()->count());

        // Адміністратор прив’язує донат без коду до іншої заявки.
        $admin = User::factory()->admin()->create();
        $second = app(TopUps::class)->create($user, 50);
        $orphan = PlusDonation::query()->whereNull('topup_id')->firstOrFail();
        $this->actingAs($admin)->post("/admin/billing/donations/{$orphan->id}/attach", ['code' => $second->code])->assertRedirect();
        $this->assertSame(20000, $user->fresh()->balance);
    }

    public function test_code_is_found_in_any_reasonable_spelling(): void
    {
        $this->assertSame('GC-AB3K9Z', TopUps::codeIn('за GameCon+ gc-ab3k9z дякую'));
        $this->assertSame('GC-AB3K9Z', TopUps::codeIn('GC AB3K9Z'));
        $this->assertSame('GC-AB3K9Z', TopUps::codeIn('gcab3k9z'));
        $this->assertNull(TopUps::codeIn('GC-AB3K9Z7'));
        $this->assertNull(TopUps::codeIn(null));
    }

    public function test_purchase_needs_enough_balance_and_turns_on_renewal(): void
    {
        $user = User::factory()->create();
        $this->fund($user, 100);

        $this->actingAs($user)->postJson('/plus/billing/purchase', ['product' => 'plus_month', 'renew' => true])
            ->assertStatus(422)->assertJsonPath('errors.shortfall.0', '4900');
        $this->assertFalse($user->fresh()->isPlus());
        $this->assertSame(10000, $user->fresh()->balance);

        $this->fund($user, 100);
        $this->actingAs($user)->postJson('/plus/billing/purchase', ['product' => 'plus_month', 'renew' => true])->assertOk()->assertJsonPath('balance', 5100);
        $this->assertTrue($user->fresh()->isPlus());
        $this->assertDatabaseHas('plus_payments', ['user_id' => $user->id, 'provider' => 'wallet', 'product' => 'plus_month', 'amount' => 14900, 'status' => PlusPayment::PAID]);
        $this->assertDatabaseHas('plus_renewals', ['owner_type' => 'user', 'owner_id' => $user->id, 'product' => 'plus_month', 'active' => true]);

        // Друга покупка додає дні після чинного періоду.
        $this->fund($user, 100);
        $this->actingAs($user)->postJson('/plus/billing/purchase', ['product' => 'plus_month'])->assertOk();
        $this->assertSame(now()->addDays(60)->toDateString(), $user->fresh()->plus_until->toDateString());
        // Без галочки автопродовження вимикається.
        $this->assertDatabaseHas('plus_renewals', ['owner_id' => $user->id, 'active' => false]);
    }

    public function test_auto_renewal_charges_the_wallet_a_day_before_the_end(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $this->fund($user, 149);
        $this->actingAs($user)->postJson('/plus/billing/purchase', ['product' => 'plus_month', 'renew' => true])->assertOk();

        // Ще рано.
        Artisan::call('billing:tick');
        $this->assertSame(1, PlusPayment::query()->count());

        // За добу до кінця грошей нема — сповіщення раз, без списання.
        $this->travel(29)->days();
        Artisan::call('billing:tick');
        Artisan::call('billing:tick');
        $this->assertSame(1, PlusPayment::query()->count());
        Notification::assertSentToTimes($user, BillingNotice::class, 1);
        $this->assertNotNull(PlusRenewal::query()->first()->failed_at);

        // Поповнили — продовження спрацьовує одразу.
        $topup = app(TopUps::class)->create($user, 149);
        app(TopUps::class)->confirm($topup, null);
        $this->assertSame(2, PlusPayment::query()->count());
        $this->assertSame(0, $user->fresh()->balance);
        $this->assertSame(now()->addDays(31)->toDateString(), $user->fresh()->plus_until->toDateString());
        Notification::assertSentTo($user, BillingNotice::class, fn (BillingNotice $n) => $n->kind === 'plus_renewed');
        $this->assertDatabaseHas('wallet_transactions', ['user_id' => $user->id, 'type' => 'renewal', 'amount' => -14900]);

        // Вимкнути автопродовження можна будь-коли.
        $this->actingAs($user)->postJson('/plus/billing/renewals', ['product' => 'plus_month', 'active' => false])->assertOk();
        $this->assertFalse(PlusRenewal::query()->first()->active);
    }

    public function test_gift_from_wallet_and_refund_back_to_wallet(): void
    {
        Notification::fake();
        $payer = User::factory()->create();
        $friend = User::factory()->create(['username' => 'friend']);
        $admin = User::factory()->admin()->create();
        $this->fund($payer, 200);

        $this->actingAs($payer)->postJson('/plus/billing/purchase', ['product' => 'gift_month', 'username' => $payer->username])->assertStatus(422);
        $this->actingAs($payer)->postJson('/plus/billing/purchase', ['product' => 'gift_month', 'username' => '@friend'])->assertOk();
        $this->assertTrue($friend->fresh()->isPlus());
        $this->assertFalse($payer->fresh()->isPlus());
        Notification::assertSentTo($friend, PlusGifted::class);
        $this->assertSame(5100, $payer->fresh()->balance);

        $payment = PlusPayment::query()->firstOrFail();
        $this->actingAs($admin)->post("/admin/billing/payments/{$payment->id}/refund")->assertRedirect();
        $this->assertFalse($friend->fresh()->isPlus());
        $this->assertSame(20000, $payer->fresh()->balance);
        $this->assertSame(PlusPayment::REFUNDED, $payment->fresh()->status);
        $this->actingAs($admin)->post("/admin/billing/payments/{$payment->id}/refund")->assertStatus(422);
    }

    public function test_admin_adjusts_balance_and_products_on_sale(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create(['username' => 'taras']);

        $this->actingAs($user)->get('/admin/billing')->assertForbidden();
        $this->actingAs($admin)->post('/admin/billing/adjust', ['username' => '@taras', 'amount' => '50', 'reason' => 'Переказ на картку'])->assertRedirect();
        $this->assertSame(5000, $user->fresh()->balance);
        $this->actingAs($admin)->post('/admin/billing/adjust', ['username' => '@taras', 'amount' => '-80', 'reason' => 'Помилка'])->assertStatus(422);
        $this->assertSame(5000, $user->fresh()->balance);

        // Знятий з продажу товар зникає з цін і не купується.
        $keys = array_keys((array) config('plus.products'));
        $this->actingAs($admin)->put('/admin/billing/products', ['enabled' => array_values(array_diff($keys, ['promo_banner_30']))])->assertRedirect();
        $this->get('/pricing')->assertInertia(fn (Assert $page) => $page->has('products', count($keys) - 1));
        $this->fund($user, 3000);
        $this->actingAs($user)->postJson('/plus/billing/purchase', ['product' => 'promo_banner_30', 'server_id' => 1])->assertStatus(422);

        // Способи поповнення: посилання лише https.
        $this->actingAs($admin)->put('/admin/billing/methods', ['methods' => [['key' => 'bmc', 'enabled' => true, 'url' => 'http://x.test']]])
            ->assertSessionHasErrors('methods.0.url');
        $this->actingAs($admin)->put('/admin/billing/methods', ['methods' => [['key' => 'bmc', 'enabled' => true, 'url' => 'https://buymeacoffee.com/gamecon']]])
            ->assertSessionHasNoErrors();
        $this->assertSame(['bmc'], collect(app(TopUps::class)->methods())->pluck('key')->all());
    }

    public function test_wallet_never_goes_negative(): void
    {
        $user = User::factory()->create();
        $this->fund($user, 10);
        $this->expectException(InsufficientFunds::class);
        app(Wallet::class)->debit($user, 1001, 'purchase', 'Тест');
    }
}
