<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\TwoFactorAuthentication;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

/**
 * Регресія на весь цикл 2FA: увімкнення генерує НЕпідтверджений секрет,
 * підтвердження вимагає вірний TOTP-код і видає резервні коди, вхід зі
 * увімкненою 2FA обов'язково проходить через /two-factor-challenge (без
 * коду сесія лишається НЕавтентифікованою — саме тут найлегше зламати
 * щось непомітно), а резервний код одноразовий.
 */
class TwoFactorAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    private function currentOtp(User $user): string
    {
        return (new Google2FA())->getCurrentOtp($user->fresh()->two_factor_secret);
    }

    public function test_enabling_generates_an_unconfirmed_secret(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($user)->post(route('two-factor.enable'));

        $user->refresh();
        $this->assertNotNull($user->two_factor_secret);
        $this->assertFalse($user->hasConfirmedTwoFactor());
    }

    public function test_confirming_with_the_correct_code_activates_two_factor_and_issues_recovery_codes(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $this->actingAs($user)->post(route('two-factor.enable'));

        $code = $this->currentOtp($user);
        $response = $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $code]);

        $user->refresh();
        $response->assertSessionHas('recoveryCodes');
        $this->assertTrue($user->hasConfirmedTwoFactor());
        $this->assertCount(8, $user->two_factor_recovery_codes);
    }

    public function test_confirming_with_a_wrong_code_fails(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $this->actingAs($user)->post(route('two-factor.enable'));

        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => '000000'])
            ->assertSessionHasErrors('code');

        $this->assertFalse($user->fresh()->hasConfirmedTwoFactor());
    }

    public function test_login_does_not_authenticate_when_two_factor_is_enabled(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        $this->post(route('logout'));

        $response = $this->post('/login', ['email' => $user->email, 'password' => 'password']);

        $response->assertRedirect(route('two-factor.login'));
        $this->assertGuest();
    }

    public function test_completing_the_challenge_with_a_valid_code_logs_in(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        $this->post(route('logout'));

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $response = $this->post(route('two-factor.login.store'), ['code' => $this->currentOtp($user)]);

        $response->assertRedirect('/feed');
        $this->assertAuthenticatedAs($user);
    }

    public function test_a_wrong_code_at_the_challenge_does_not_log_in(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        $this->post(route('logout'));

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $this->post(route('two-factor.login.store'), ['code' => '000000'])
            ->assertSessionHasErrors('code');

        $this->assertGuest();
    }

    public function test_a_recovery_code_logs_in_and_is_consumed(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        $recoveryCode = $user->fresh()->two_factor_recovery_codes[0];
        $this->post(route('logout'));

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $response = $this->post(route('two-factor.login.store'), ['recovery_code' => $recoveryCode]);

        $response->assertRedirect('/feed');
        $this->assertAuthenticatedAs($user);
        $this->assertNotContains($recoveryCode, $user->fresh()->two_factor_recovery_codes);
        $this->assertCount(7, $user->fresh()->two_factor_recovery_codes);
    }

    public function test_a_used_recovery_code_cannot_be_reused(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        $recoveryCode = $user->fresh()->two_factor_recovery_codes[0];
        $this->post(route('logout'));

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $this->post(route('two-factor.login.store'), ['recovery_code' => $recoveryCode]);
        $this->post(route('logout'));

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $this->post(route('two-factor.login.store'), ['recovery_code' => $recoveryCode])
            ->assertSessionHasErrors('code');

        $this->assertGuest();
    }

    public function test_user_can_disable_two_factor_with_their_password(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);

        $this->actingAs($user)->delete(route('two-factor.disable'), ['password' => 'password']);

        $user->refresh();
        $this->assertFalse($user->hasConfirmedTwoFactor());
        $this->assertNull($user->two_factor_secret);
    }

    public function test_disabling_requires_the_correct_password(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);

        $this->actingAs($user)->delete(route('two-factor.disable'), ['password' => 'wrong-password'])
            ->assertSessionHasErrors('password');

        $this->assertTrue($user->fresh()->hasConfirmedTwoFactor());
    }

    public function test_completing_the_challenge_with_remember_device_sets_a_trust_cookie(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        $this->post(route('logout'));

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $response = $this->post(route('two-factor.login.store'), [
            'code' => $this->currentOtp($user),
            'remember_device' => true,
        ]);

        $response->assertRedirect('/feed');
        $this->assertNotNull($response->headers->getCookies()[0] ?? null);
        $this->assertSame(TwoFactorAuthentication::TRUST_COOKIE, $response->headers->getCookies()[0]->getName());
        $this->assertCount(1, $user->fresh()->two_factor_trusted_devices);
    }

    public function test_a_trusted_device_cookie_skips_the_challenge_on_next_login(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        $this->post(route('logout'));

        $this->post('/login', ['email' => $user->email, 'password' => 'password']);
        $loginResponse = $this->post(route('two-factor.login.store'), [
            'code' => $this->currentOtp($user),
            'remember_device' => true,
        ]);
        $token = $loginResponse->headers->getCookies()[0]->getValue();
        $this->post(route('logout'));

        $response = $this->withUnencryptedCookie(TwoFactorAuthentication::TRUST_COOKIE, $token)
            ->post('/login', ['email' => $user->email, 'password' => 'password']);

        $response->assertRedirect('/feed');
        $this->assertAuthenticatedAs($user);
    }

    public function test_an_unknown_device_cookie_still_requires_the_challenge(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        $this->post(route('logout'));

        $response = $this->withUnencryptedCookie(TwoFactorAuthentication::TRUST_COOKIE, 'not-a-real-token')
            ->post('/login', ['email' => $user->email, 'password' => 'password']);

        $response->assertRedirect(route('two-factor.login'));
        $this->assertGuest();
    }

    public function test_forgetting_trusted_devices_clears_the_stored_list(): void
    {
        $user = User::factory()->create(['email_verified_at' => now(), 'password' => bcrypt('password')]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        app(TwoFactorAuthentication::class)->trustDevice($user);
        $this->assertCount(1, $user->fresh()->two_factor_trusted_devices);

        $this->actingAs($user)->delete(route('two-factor.forget-trusted-devices'));

        $this->assertCount(0, $user->fresh()->two_factor_trusted_devices);
    }

    public function test_trusted_devices_endpoint_reports_the_active_count(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $this->actingAs($user)->post(route('two-factor.enable'));
        $this->actingAs($user)->post(route('two-factor.confirm'), ['code' => $this->currentOtp($user)]);
        app(TwoFactorAuthentication::class)->trustDevice($user);

        $this->actingAs($user)->getJson(route('two-factor.trusted-devices'))
            ->assertJsonPath('data.count', 1);
    }
}
