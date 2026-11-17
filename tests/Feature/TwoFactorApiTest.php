<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\ApiTokens;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Fortify\Features;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class TwoFactorApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());
    }

    public function test_app_enables_confirms_and_disables_totp(): void
    {
        $user = User::factory()->create();
        $token = app(ApiTokens::class)->issue($user);

        $this->withToken($token)->postJson('/api/v1/user/two-factor-authentication', [])->assertUnprocessable();
        $this->withToken($token)->postJson('/api/v1/user/two-factor-authentication', ['password' => 'wrong'])->assertUnprocessable();

        $setup = $this->withToken($token)->postJson('/api/v1/user/two-factor-authentication', ['password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['svg', 'url', 'secretKey'])
            ->json();

        $this->assertFalse($user->fresh()->hasEnabledTwoFactorAuthentication());
        $this->assertStringStartsWith('otpauth://totp/', $setup['url']);
        $this->assertStringContainsString($setup['secretKey'], $setup['url']);
        $this->assertStringContainsString('<svg', $setup['svg']);
        $this->withToken($token)->getJson('/api/v1/me')->assertOk()
            ->assertJsonPath('user.two_factor', false)
            ->assertJsonPath('user.two_factor_pending', true)
            ->assertJsonPath('user.plugins.voice_stage', true);

        $this->withToken($token)->json('GET', '/api/v1/user/two-factor-qr-code', ['password' => 'password'])
            ->assertOk()
            ->assertJsonPath('url', $setup['url']);
        $this->withToken($token)->json('GET', '/api/v1/user/two-factor-secret-key', ['password' => 'password'])
            ->assertOk()
            ->assertJsonPath('secretKey', $setup['secretKey']);

        $this->withToken($token)->postJson('/api/v1/user/confirmed-two-factor-authentication', ['code' => '000000'])->assertUnprocessable();

        $code = app(Google2FA::class)->getCurrentOtp($setup['secretKey']);
        $confirmed = $this->withToken($token)->postJson('/api/v1/user/confirmed-two-factor-authentication', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('two_factor', true)
            ->json('recovery_codes');
        $this->assertCount(8, $confirmed);
        $this->assertTrue($user->fresh()->hasEnabledTwoFactorAuthentication());
        $this->withToken($token)->getJson('/api/v1/me')->assertJsonPath('user.two_factor', true)->assertJsonPath('user.two_factor_pending', false);

        $shown = $this->withToken($token)->postJson('/api/v1/user/two-factor-recovery-codes', ['password' => 'password', 'regenerate' => false])
            ->assertOk()
            ->json('recovery_codes');
        $this->assertSame($confirmed, $shown);

        $fresh = $this->withToken($token)->postJson('/api/v1/user/two-factor-recovery-codes', ['password' => 'password'])
            ->assertOk()
            ->json('recovery_codes');
        $this->assertCount(8, $fresh);
        $this->assertNotSame($confirmed, $fresh);

        $this->withToken($token)->deleteJson('/api/v1/user/two-factor-authentication', ['password' => 'wrong'])->assertUnprocessable();
        $this->withToken($token)->deleteJson('/api/v1/user/two-factor-authentication', ['password' => 'password'])
            ->assertOk()
            ->assertJsonPath('two_factor', false);
        $this->assertNull($user->fresh()->two_factor_secret);
        $this->assertNull($user->fresh()->two_factor_confirmed_at);
    }
}
