<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Billing\Wallet;
use App\Services\Plus\Plus;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GameCon+ у застосунку: лише статус доступу. Жодних цін, сум, способів оплати чи посилань на сайт —
 * інакше застосунок порушить Google Play Payments policy (anti-steering).
 */
class AppSubscriptionStatusTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return app(ApiTokens::class)->issue($user, 'android');
    }

    public function test_status_returns_clean_flags_only(): void
    {
        app(SiteSettings::class)->put(['plus_methods' => ['donatello' => ['enabled' => true, 'url' => 'https://donatello.to/gamecon']]]);
        $user = User::factory()->create();
        $token = $this->token($user);
        $this->getJson('/api/v1/user/subscription-status')->assertUnauthorized();

        $this->withToken($token)->getJson('/api/v1/user/subscription-status')
            ->assertOk()->assertExactJson(['is_pro' => false, 'expires_at' => null, 'plan_name' => null, 'style' => null]);

        app(Plus::class)->grant($user, 30, 'admin');
        app(Wallet::class)->credit($user, 50000, 'topup', 'Тест');
        $response = $this->withToken($token)->getJson('/api/v1/user/subscription-status')->assertOk()
            ->assertJsonPath('is_pro', true)
            ->assertJsonPath('plan_name', 'GameCon+')
            ->assertJsonPath('expires_at', $user->fresh()->plus_until->utc()->toIso8601ZuluString());

        $this->assertNoPaymentData($response->getContent());
        $this->assertNoPaymentData($this->withToken($token)->getJson('/api/v1/me')->getContent());
    }

    private function assertNoPaymentData(string $json): void
    {
        foreach (['http', 'billing', 'balance', 'price', '₴', 'donatello', 'checkout', 'paddle', 'topup'] as $needle) {
            if ($needle === 'http' && preg_match('#https?://[^"]*(billing|plus|pricing|donat|checkout)#i', $json)) {
                $this->fail('Посилання на оплату у відповіді для застосунку: '.$json);
            }
            if ($needle !== 'http') {
                $this->assertStringNotContainsStringIgnoringCase($needle, $json, "«{$needle}» у відповіді для застосунку");
            }
        }
    }

    public function test_review_account_command_gives_active_plus(): void
    {
        $this->artisan('plus:review-account')->assertSuccessful();
        $user = User::query()->where('email', 'play-review@gamecon.online')->firstOrFail();
        $this->assertTrue($user->isPlus());
        $this->assertTrue($user->plus_until->gt(now()->addDays(360)));
        $this->assertNotNull($user->email_verified_at);

        // Повторний запуск не накопичує зайві періоди.
        $this->artisan('plus:review-account --keep-password')->assertSuccessful();
        $this->assertTrue($user->fresh()->plus_until->lt(now()->addDays(366)));

        $this->withToken(app(ApiTokens::class)->issue($user, 'android'))->getJson('/api/v1/user/subscription-status')
            ->assertJsonPath('is_pro', true);
    }
}
