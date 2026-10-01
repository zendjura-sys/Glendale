<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SocialAuthTest extends TestCase
{
    use RefreshDatabase;

    private const PROJECT = 'gamecon-test';

    private const KID = 'test-key-1';

    private \OpenSSLAsymmetricKey $key;

    /** @var array<string, mixed> */
    private array $discordMe = [];

    /** @var array<string, array<string, mixed>> */
    private array $tokeninfo = [];

    protected function setUp(): void
    {
        parent::setUp();

        $settings = app(SiteSettings::class);
        $settings->put([
            'discord_client_id' => '123456789012345678',
            'firebase_api_key' => 'AIzaSyTestTestTestTestTestTestTestTest',
            'firebase_project_id' => self::PROJECT,
            'firebase_app_id' => '1:142512043248:web:283f94b85f0c3ffc',
        ]);
        $settings->putSecret('discord_client_secret', 'discord-secret-value-123456');

        $this->key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $csr = openssl_csr_new(['commonName' => 'securetoken'], $this->key, ['digest_alg' => 'sha256']);
        openssl_x509_export(openssl_csr_sign($csr, null, $this->key, 1, ['digest_alg' => 'sha256']), $cert);
        Cache::forget('firebase.certs');

        Http::fake([
            'discord.com/api/oauth2/token' => Http::response(['access_token' => 'tok', 'token_type' => 'Bearer']),
            'discord.com/api/users/@me' => fn () => Http::response($this->discordMe),
            'oauth2.googleapis.com/tokeninfo*' => function ($request) {
                parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);
                $claims = $this->tokeninfo[$query['id_token'] ?? ''] ?? null;

                return $claims ? Http::response($claims) : Http::response(['error' => 'invalid_token'], 400);
            },
            'identitytoolkit.googleapis.com/*' => Http::response('<html>403 robot</html>', 403, ['Content-Type' => 'text/html']),
            'www.googleapis.com/robot/*' => Http::response([self::KID => $cert], 200, ['Cache-Control' => 'public, max-age=3600']),
            'cdn.discordapp.com/*' => Http::response($this->png(), 200, ['Content-Type' => 'image/png']),
            'lh3.googleusercontent.com/*' => Http::response($this->png(), 200, ['Content-Type' => 'image/png']),
        ]);
    }

    public function test_login_page_shares_configured_providers(): void
    {
        $this->get('/login')->assertInertia(fn (Assert $page) => $page
            ->where('site.social.discord', true)
            ->where('site.social.google.projectId', self::PROJECT)
            ->where('site.social.google.authDomain', self::PROJECT.'.firebaseapp.com'));

        app(SiteSettings::class)->put(['discord_client_id' => null, 'firebase_project_id' => null]);

        $this->get('/login')->assertInertia(fn (Assert $page) => $page
            ->where('site.social.discord', false)
            ->where('site.social.google', null));
    }

    public function test_discord_registers_new_user_with_avatar(): void
    {
        $this->fakeDiscord(['id' => '80351110224678912', 'username' => 'mark_scaletta', 'global_name' => 'Марк Скалетта', 'email' => 'Mark@Example.com', 'verified' => true, 'avatar' => 'abc']);

        $response = $this->get('/auth/discord');
        $response->assertRedirect();
        $this->assertStringStartsWith('https://discord.com/oauth2/authorize?', $response->headers->get('Location'));
        $state = session('discord_oauth_state');

        $this->get('/auth/discord/callback?code=good&state='.$state)->assertRedirect('/feed');

        $user = User::query()->where('discord_id', '80351110224678912')->firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame('mark@example.com', $user->email);
        $this->assertSame('mark_scaletta', $user->username);
        $this->assertSame('mark_scaletta', $user->discord_username);
        $this->assertSame(['Марк', 'Скалетта'], [$user->first_name, $user->last_name]);
        $this->assertNotNull($user->email_verified_at);
        $this->assertNotNull($user->avatar_path);
        $this->assertSame(User::ROLE_ADMIN, $user->role);

        Http::assertSent(fn ($request) => str_contains($request->url(), '/oauth2/token') && $request['code'] === 'good'
            && $request['redirect_uri'] === route('auth.discord.callback'));

        auth()->logout();
        $this->get('/auth/discord');
        $this->get('/auth/discord/callback?code=good&state='.session('discord_oauth_state'))->assertRedirect('/feed');
        $this->assertAuthenticatedAs($user);
        $this->assertSame(1, User::query()->count());
    }

    public function test_discord_callback_rejects_bad_state(): void
    {
        $this->fakeDiscord(['id' => '1', 'username' => 'x', 'email' => 'x@example.com', 'verified' => true]);
        $this->get('/auth/discord');

        $this->get('/auth/discord/callback?code=good&state=forged')->assertRedirect('/login');
        $this->get('/auth/discord/callback?error=access_denied')->assertRedirect('/login');

        $this->assertGuest();
        Http::assertNotSent(fn ($request) => str_contains($request->url(), '/oauth2/token'));
    }

    public function test_discord_links_existing_account_only_by_verified_email(): void
    {
        $existing = User::factory()->create(['email' => 'player@example.com']);

        $this->fakeDiscord(['id' => '555', 'username' => 'player', 'email' => 'player@example.com', 'verified' => false]);
        $this->get('/auth/discord');
        $this->get('/auth/discord/callback?code=c&state='.session('discord_oauth_state'))->assertRedirect('/login');
        $this->assertGuest();
        $this->assertNull($existing->refresh()->discord_id);
        $this->assertStringContainsString('уже існує', session('inertia.flash_data.toast.message'));

        $this->fakeDiscord(['id' => '555', 'username' => 'player', 'email' => 'player@example.com', 'verified' => true]);
        $this->get('/auth/discord');
        $this->get('/auth/discord/callback?code=c&state='.session('discord_oauth_state'))->assertRedirect('/feed');
        $this->assertAuthenticatedAs($existing);
        $this->assertSame('555', $existing->refresh()->discord_id);
    }

    public function test_logged_in_user_links_and_unlinks_discord(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $other->forceFill(['discord_id' => '999'])->save();

        $this->fakeDiscord(['id' => '999', 'username' => 'taken', 'email' => 'a@example.com', 'verified' => true]);
        $this->actingAs($user)->get('/auth/discord');
        $this->get('/auth/discord/callback?code=c&state='.session('discord_oauth_state'))->assertRedirect('/settings/profile');
        $this->assertNull($user->refresh()->discord_id);
        $this->assertStringContainsString('іншого профілю', session('inertia.flash_data.toast.message'));

        $this->fakeDiscord(['id' => '777', 'username' => 'mine', 'email' => 'b@example.com', 'verified' => true]);
        $this->get('/auth/discord');
        $this->get('/auth/discord/callback?code=c&state='.session('discord_oauth_state'))->assertRedirect('/settings/profile');
        $this->assertSame(['777', 'mine'], [$user->refresh()->discord_id, $user->discord_username]);

        $this->get('/settings/profile')->assertInertia(fn (Assert $page) => $page
            ->where('connections.0.provider', 'discord')
            ->where('connections.0.connected', true)
            ->where('connections.0.account', 'mine')
            ->where('connections.1.connected', false));

        $this->delete('/auth/social/discord')->assertRedirect();
        $this->assertNull($user->refresh()->discord_id);
        $this->delete('/auth/social/twitter')->assertNotFound();
    }

    public function test_banned_and_two_factor_users_via_discord(): void
    {
        $banned = User::factory()->create();
        $banned->forceFill(['discord_id' => '1', 'banned_at' => now()])->save();
        $this->fakeDiscord(['id' => '1', 'username' => 'b', 'email' => 'b@example.com', 'verified' => true]);
        $this->get('/auth/discord');
        $this->get('/auth/discord/callback?code=c&state='.session('discord_oauth_state'))->assertRedirect('/login');
        $this->assertGuest();

        $secure = User::factory()->create();
        $secure->forceFill(['discord_id' => '2', 'two_factor_secret' => encrypt('secret'), 'two_factor_confirmed_at' => now()])->save();
        $this->fakeDiscord(['id' => '2', 'username' => 's', 'email' => 's@example.com', 'verified' => true]);
        $this->get('/auth/discord');
        $this->get('/auth/discord/callback?code=c&state='.session('discord_oauth_state'))->assertRedirect('/two-factor-challenge');
        $this->assertGuest();
        $this->assertSame($secure->id, session('login.id'));
    }

    public function test_registration_closed_blocks_new_social_accounts(): void
    {
        app(SiteSettings::class)->put(['registration_open' => false]);

        $this->post('/auth/firebase', ['id_token' => $this->firebaseToken()])->assertRedirect('/login');
        $this->assertGuest();
        $this->assertSame(0, User::query()->count());
    }

    public function test_google_firebase_token_registers_and_logs_in(): void
    {
        $this->post('/auth/firebase', ['id_token' => $this->firebaseToken()])->assertRedirect('/feed');

        $user = User::query()->where('google_id', '1122334455')->firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame('olena@gmail.com', $user->google_email);
        $this->assertSame(['Олена', 'Мельник'], [$user->first_name, $user->last_name]);
        $this->assertSame('olena', $user->username);
        $this->assertNotNull($user->avatar_path);

        auth()->logout();
        $this->post('/auth/firebase', ['id_token' => $this->firebaseToken()])->assertRedirect('/feed');
        $this->assertAuthenticatedAs($user);
        $this->assertSame(1, User::query()->count());
    }

    public function test_google_firebase_rejects_forged_tokens(): void
    {
        $other = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);

        $forged = [
            $this->firebaseToken(['aud' => 'someone-else']),
            $this->firebaseToken(['iss' => 'https://securetoken.google.com/someone-else']),
            $this->firebaseToken(['exp' => time() - 3600]),
            $this->firebaseToken(['firebase' => ['sign_in_provider' => 'password']]),
            $this->firebaseToken([], $other),
            $this->firebaseToken([], null, 'unknown-kid'),
            'not.a.jwt',
            'garbage',
        ];

        foreach ($forged as $token) {
            $this->post('/auth/firebase', ['id_token' => $token])->assertRedirect('/login');
        }

        $this->assertGuest();
        $this->assertSame(0, User::query()->count());
    }

    public function test_logged_in_user_links_google(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post('/auth/firebase', ['id_token' => $this->firebaseToken()])->assertRedirect('/settings/profile');

        $this->assertSame(['1122334455', 'olena@gmail.com'], [$user->refresh()->google_id, $user->google_email]);
        $this->assertNotSame('olena@gmail.com', $user->email);
    }

    public function test_google_token_is_verified_via_tokeninfo(): void
    {
        $claims = [
            'iss' => 'https://accounts.google.com',
            'aud' => '142512043248-abc123.apps.googleusercontent.com',
            'sub' => '108777666555',
            'email' => 'Taras@Gmail.com',
            'email_verified' => 'true',
            'name' => 'Тарас Бойко',
            'exp' => (string) (time() + 3000),
        ];
        $this->tokeninfo = [
            'good' => $claims,
            'other-project' => [...$claims, 'aud' => '999999999-abc.apps.googleusercontent.com'],
            'expired' => [...$claims, 'exp' => (string) (time() - 10)],
            'bad-issuer' => [...$claims, 'iss' => 'evil.example'],
        ];

        foreach (['other-project', 'expired', 'bad-issuer', 'unknown'] as $token) {
            $this->post('/auth/firebase', ['id_token' => 'ignored', 'google_token' => $token])->assertRedirect('/login');
        }
        $this->assertGuest();
        $this->assertSame(0, User::query()->count());

        $this->post('/auth/firebase', ['id_token' => 'ignored', 'google_token' => 'good'])->assertRedirect('/feed');
        $user = User::query()->where('google_id', '108777666555')->firstOrFail();
        $this->assertAuthenticatedAs($user);
        $this->assertSame(['taras@gmail.com', 'Тарас', 'Бойко'], [$user->email, $user->first_name, $user->last_name]);
        $this->assertNotNull($user->email_verified_at);

        $this->post('/auth/firebase', [])->assertSessionHasErrors('id_token');
    }

    public function test_firebase_check_works_when_googleapis_blocks_the_server(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)->post('/admin/integrations/cinema/firebase/test')->assertRedirect();
        $this->assertSame('success', session('inertia.flash_data.toast.type'));

        app(SiteSettings::class)->put(['firebase_app_id' => null]);
        $this->get('/settings/profile')->assertInertia(fn (Assert $page) => $page->where('site.social.google', null));
    }

    public function test_admin_can_configure_social_providers(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)->get('/admin/integrations')->assertInertia(fn (Assert $page) => $page
            ->where('cinema.0.key', 'discord')
            ->where('cinema.0.group', 'auth')
            ->where('cinema.1.key', 'firebase'));

        $this->put('/admin/integrations/cinema/discord', ['client_id' => 'abc'])->assertSessionHasErrors('client_id');
        $this->put('/admin/integrations/cinema/firebase', ['api_key' => 'AIzaSyNewNewNewNewNewNewNewNewNewNewNew', 'project_id' => 'my-project', 'auth_domain' => 'auth.gamecon.online', 'app_id' => '1:555:web:abc'])
            ->assertSessionHasNoErrors();

        auth()->logout();
        $this->get('/login')->assertInertia(fn (Assert $page) => $page
            ->where('site.social.google.projectId', 'my-project')
            ->where('site.social.google.authDomain', 'auth.gamecon.online'));
    }

    /**
     * @param  array<string, mixed>  $me
     */
    private function fakeDiscord(array $me): void
    {
        $this->discordMe = $me;
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function firebaseToken(array $overrides = [], ?\OpenSSLAsymmetricKey $key = null, string $kid = self::KID): string
    {
        $now = time();
        $claims = array_replace([
            'iss' => 'https://securetoken.google.com/'.self::PROJECT,
            'aud' => self::PROJECT,
            'auth_time' => $now - 5,
            'iat' => $now - 5,
            'exp' => $now + 3600,
            'sub' => 'firebase-uid-1',
            'name' => 'Олена Мельник',
            'email' => 'olena@gmail.com',
            'email_verified' => true,
            'picture' => 'https://lh3.googleusercontent.com/a/photo=s96-c',
            'firebase' => ['sign_in_provider' => 'google.com', 'identities' => ['google.com' => ['1122334455'], 'email' => ['olena@gmail.com']]],
        ], $overrides);

        $encode = fn (array $data) => rtrim(strtr(base64_encode((string) json_encode($data)), '+/', '-_'), '=');
        $input = $encode(['alg' => 'RS256', 'kid' => $kid, 'typ' => 'JWT']).'.'.$encode($claims);
        openssl_sign($input, $signature, $key ?? $this->key, OPENSSL_ALGO_SHA256);

        return $input.'.'.rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    }

    private function png(): string
    {
        $image = imagecreatetruecolor(64, 64);
        imagefill($image, 0, 0, (int) imagecolorallocate($image, 120, 90, 255));
        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }
}
