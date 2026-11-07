<?php

namespace Tests\Feature;

use App\Jobs\SendPushNotification;
use App\Models\AppLoginRequest;
use App\Models\LoginEvent;
use App\Models\PushDevice;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

/** «Увійти через застосунок GameCon»: браузер просить вхід, застосунок підтверджує. */
class AppLoginTest extends TestCase
{
    use RefreshDatabase;

    private const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

    private function appToken(User $user): string
    {
        return app(ApiTokens::class)->issue($user, 'android');
    }

    private function configureFcm(): void
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $pem);

        app(SiteSettings::class)->putSecret('fcm_service_account', (string) json_encode([
            'type' => 'service_account',
            'project_id' => 'gamecon-test',
            'client_email' => 'push@gamecon-test.iam.gserviceaccount.com',
            'private_key' => $pem,
            'token_uri' => 'https://oauth2.googleapis.com/token',
        ]));
    }

    /**
     * @param  array<string, string>  $data
     * @return array{id: string, secret: string, code: string, qr: string, deep_link: string, expires_at: string}
     */
    private function start(array $data = []): array
    {
        return $this->withHeader('User-Agent', self::BROWSER)
            ->postJson('/login/app/requests', $data)
            ->assertCreated()
            ->assertJsonStructure(['id', 'secret', 'code', 'qr', 'deep_link', 'expires_at'])
            ->json();
    }

    private function poll(array $request): string
    {
        return (string) $this->withHeader('User-Agent', self::BROWSER)
            ->getJson('/login/app/requests/'.$request['id'].'?secret='.$request['secret'])
            ->assertOk()
            ->json('status');
    }

    /** Наступний запит — уже з іншого пристрою: без входу, який лишився з попереднього. */
    private function freshClient(): void
    {
        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $this->flushHeaders();
    }

    public function test_request_returns_code_qr_and_deep_link_and_stays_pending(): void
    {
        $request = $this->start();

        $this->assertMatchesRegularExpression('/^\d{2}$/', $request['code']);
        $this->assertSame(rtrim((string) config('app.url'), '/').'/app-login/'.$request['id'], $request['qr']);
        $this->assertSame('gamecon://app-login/'.$request['id'], $request['deep_link']);
        $this->assertSame('pending', $this->poll($request));
        $this->assertGuest('web');

        // Секрет у базі лише хешем, без нього стан не дізнатися.
        $row = AppLoginRequest::query()->findOrFail($request['id']);
        $this->assertNotSame($request['secret'], $row->secret_hash);
        $this->getJson('/login/app/requests/'.$request['id'].'?secret=wrong')->assertNotFound();
    }

    public function test_login_hint_sends_push_only_to_app_and_never_reveals_the_account(): void
    {
        $this->configureFcm();
        Bus::fake([SendPushNotification::class]);
        $user = User::factory()->create(['username' => 'neo']);
        PushDevice::query()->create(['user_id' => $user->id, 'token' => str_repeat('a', 40), 'platform' => 'android']);

        $known = $this->postJson('/login/app/requests', ['login' => '@neo'])->assertCreated();
        $unknown = $this->postJson('/login/app/requests', ['login' => 'nobody@example.com'])->assertCreated();

        $this->assertSame(array_keys($known->json()), array_keys($unknown->json()));
        Bus::assertDispatchedTimes(SendPushNotification::class, 1);
        Bus::assertDispatched(SendPushNotification::class, fn (SendPushNotification $job) => $job->userId === $user->id
            && $job->appOnly
            && $job->data['type'] === 'app_login'
            && $job->data['id'] === $known->json('id'));

        // Пошта теж підходить.
        $this->postJson('/login/app/requests', ['login' => strtoupper($user->email)])->assertCreated();
        Bus::assertDispatchedTimes(SendPushNotification::class, 2);
    }

    public function test_no_push_without_login(): void
    {
        $this->configureFcm();
        Bus::fake([SendPushNotification::class]);

        $this->start();

        Bus::assertNotDispatched(SendPushNotification::class);
    }

    public function test_app_sees_details_with_three_code_choices(): void
    {
        $user = User::factory()->create();
        $request = $this->start();

        $details = $this->withToken($this->appToken($user))->getJson('/api/v1/auth/app-login/'.$request['id'])
            ->assertOk()
            ->assertJsonPath('id', $request['id'])
            ->assertJsonPath('browser', 'Chrome')
            ->assertJsonPath('os', 'Windows')
            ->assertJsonStructure(['ip_country', 'ip_city', 'created_at', 'expires_at', 'code_choices'])
            ->json();

        $this->assertCount(3, $details['code_choices']);
        $this->assertCount(3, array_unique($details['code_choices']));
        $this->assertContains($request['code'], $details['code_choices']);

        $this->flushHeaders()->getJson('/api/v1/auth/app-login/'.$request['id'])->assertUnauthorized();
        $this->withToken($this->appToken($user))->getJson('/api/v1/auth/app-login/00000000-0000-4000-8000-000000000000')->assertNotFound();
    }

    public function test_approval_logs_the_browser_in_once(): void
    {
        $user = User::factory()->create();
        $request = $this->start();

        $this->withToken($this->appToken($user))
            ->postJson('/api/v1/auth/app-login/'.$request['id'].'/approve', ['code' => $request['code']])
            ->assertOk()->assertJsonPath('ok', true);
        $this->freshClient();

        $this->withHeader('User-Agent', self::BROWSER)
            ->getJson('/login/app/requests/'.$request['id'].'?secret='.$request['secret'])
            ->assertOk()
            ->assertJsonPath('status', 'approved')
            ->assertJsonPath('redirect', '/feed');
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertNotNull(AppLoginRequest::query()->findOrFail($request['id'])->consumed_at);

        // Журнал входів: успішний вхід через застосунок із браузера.
        $event = LoginEvent::query()->where('user_id', $user->id)->sole();
        $this->assertSame('app', $event->method);
        $this->assertTrue($event->success);
        $this->assertSame(self::BROWSER, $event->user_agent);

        // Вдруге тим самим запитом не увійти.
        $this->freshClient();
        $this->assertSame('expired', $this->poll($request));
        $this->assertGuest('web');
        $this->withToken($this->appToken($user))->getJson('/api/v1/auth/app-login/'.$request['id'])->assertStatus(410);
    }

    public function test_two_factor_users_are_not_asked_for_totp_again(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['two_factor_secret' => encrypt('secret'), 'two_factor_confirmed_at' => now()])->save();
        $request = $this->start();

        $this->withToken($this->appToken($user))->postJson('/api/v1/auth/app-login/'.$request['id'].'/approve', ['code' => $request['code']])->assertOk();
        $this->freshClient();

        $this->assertSame('approved', $this->poll($request));
        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_wrong_code_denies_the_request(): void
    {
        $user = User::factory()->create();
        $request = $this->start();
        $wrong = $request['code'] === '10' ? '11' : '10';

        $this->withToken($this->appToken($user))
            ->postJson('/api/v1/auth/app-login/'.$request['id'].'/approve', ['code' => $wrong])
            ->assertUnprocessable()
            ->assertJsonPath('errors.code.0', 'Код не збігається — вхід скасовано.');
        $this->freshClient();

        $this->assertSame('denied', $this->poll($request));
        $this->assertGuest('web');
        // Правильний код після цього вже не допоможе.
        $this->withToken($this->appToken($user))->postJson('/api/v1/auth/app-login/'.$request['id'].'/approve', ['code' => $request['code']])->assertStatus(410);

        $event = LoginEvent::query()->where('user_id', $user->id)->sole();
        $this->assertSame('app', $event->method);
        $this->assertFalse($event->success);
        $this->assertSame(self::BROWSER, $event->user_agent);
    }

    public function test_deny(): void
    {
        $user = User::factory()->create();
        $request = $this->start();

        $this->withToken($this->appToken($user))->postJson('/api/v1/auth/app-login/'.$request['id'].'/deny')->assertOk()->assertJsonPath('ok', true);
        $this->freshClient();

        $this->assertSame('denied', $this->poll($request));
        $this->assertGuest('web');
        $this->assertDatabaseHas('login_events', ['user_id' => $user->id, 'method' => 'app', 'success' => false]);
        $this->assertDatabaseHas('app_login_requests', ['id' => $request['id'], 'status' => 'denied', 'user_id' => $user->id]);
    }

    public function test_request_expires_after_two_minutes(): void
    {
        $user = User::factory()->create();
        $request = $this->start();

        $this->travel(121)->seconds();

        $this->assertSame('expired', $this->poll($request));
        $this->withToken($this->appToken($user))->getJson('/api/v1/auth/app-login/'.$request['id'])->assertStatus(410);
        $this->withToken($this->appToken($user))->postJson('/api/v1/auth/app-login/'.$request['id'].'/approve', ['code' => $request['code']])->assertStatus(410);
        $this->freshClient();
        $this->assertGuest('web');
    }

    public function test_request_for_a_login_must_be_approved_by_that_user(): void
    {
        $owner = User::factory()->create(['username' => 'trinity']);
        $other = User::factory()->create();
        $request = $this->start(['login' => 'trinity']);

        $this->withToken($this->appToken($other))->postJson('/api/v1/auth/app-login/'.$request['id'].'/approve', ['code' => $request['code']])->assertForbidden();
        $this->freshClient();
        $this->assertSame('pending', $this->poll($request));

        $this->withToken($this->appToken($owner))->postJson('/api/v1/auth/app-login/'.$request['id'].'/approve', ['code' => $request['code']])->assertOk();
        $this->freshClient();
        $this->assertSame('approved', $this->poll($request));
        $this->assertAuthenticatedAs($owner, 'web');
    }

    public function test_banned_users_cannot_approve_or_finish_the_login(): void
    {
        $banned = User::factory()->create();
        $token = $this->appToken($banned);
        $banned->forceFill(['banned_at' => now()])->save();
        $request = $this->start();

        $this->withToken($token)->postJson('/api/v1/auth/app-login/'.$request['id'].'/approve', ['code' => $request['code']])->assertForbidden();
        $this->freshClient();
        $this->assertSame('pending', $this->poll($request));

        // Заблокували вже після підтвердження — браузер усе одно не входить.
        $user = User::factory()->create();
        $second = $this->start();
        $this->withToken($this->appToken($user))->postJson('/api/v1/auth/app-login/'.$second['id'].'/approve', ['code' => $second['code']])->assertOk();
        $user->forceFill(['banned_at' => now()])->save();
        $this->freshClient();

        $this->assertSame('denied', $this->poll($second));
        $this->assertGuest('web');
    }

    public function test_requests_and_polls_are_throttled(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/login/app/requests')->assertCreated();
        }
        $this->postJson('/login/app/requests')->assertTooManyRequests();

        $request = AppLoginRequest::query()->firstOrFail();
        for ($i = 0; $i < 90; $i++) {
            $this->getJson('/login/app/requests/'.$request->id.'?secret=x')->assertNotFound();
        }
        $this->getJson('/login/app/requests/'.$request->id.'?secret=x')->assertTooManyRequests();
    }

    public function test_qr_link_opens_a_page_with_the_app_link(): void
    {
        $id = $this->start()['id'];

        $this->withoutVite()->get('/app-login/'.$id)->assertOk()->assertInertia(fn ($page) => $page
            ->component('auth/app-login')
            ->where('deepLink', 'gamecon://app-login/'.$id));
        $this->get('/app-login/not-a-uuid')->assertNotFound();
    }

    public function test_old_requests_are_pruned(): void
    {
        $this->start();
        $this->travel(AppLoginRequest::KEEP_DAYS + 1)->days();
        $this->start();

        $this->artisan('model:prune', ['--model' => [AppLoginRequest::class]])->assertSuccessful();

        $this->assertSame(1, AppLoginRequest::query()->count());
    }

    public function test_push_has_a_visible_notification_with_device_and_place(): void
    {
        $this->configureFcm();
        Bus::fake([SendPushNotification::class]);
        $user = User::factory()->create(['username' => 'morpheus']);
        PushDevice::query()->create(['user_id' => $user->id, 'token' => str_repeat('d', 40), 'platform' => 'android']);

        $this->start(['login' => 'morpheus']);

        Bus::assertDispatched(SendPushNotification::class, fn (SendPushNotification $job) => ! $job->dataOnly
            && $job->title === 'Запит на вхід у GameCon'
            && str_starts_with($job->body, 'Chrome · Windows')
            && str_ends_with($job->body, 'Підтвердіть, якщо це ви.')
            && str_starts_with($job->data['url'], '/app-login/'));
    }

    public function test_asset_links_come_from_the_admin_setting(): void
    {
        $this->get('/.well-known/assetlinks.json')->assertNotFound();

        $admin = User::factory()->admin()->create();
        $first = implode(':', array_fill(0, 32, 'AB'));
        $second = implode(':', array_fill(0, 32, '0c'));
        $base = ['enabled' => '0', 'phones' => '0'];

        $this->actingAs($admin)->put('/admin/integrations/cinema/google_play', $base + ['app_link_fingerprints' => 'AB:CD'])
            ->assertSessionHasErrors('app_link_fingerprints');
        $this->actingAs($admin)->put('/admin/integrations/cinema/google_play', $base + ['app_link_fingerprints' => $first."\n".$second])
            ->assertSessionHasNoErrors();
        $this->freshClient();

        $this->get('/.well-known/assetlinks.json')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonPath('0.relation.0', 'delegate_permission/common.handle_all_urls')
            ->assertJsonPath('0.target.namespace', 'android_app')
            ->assertJsonPath('0.target.package_name', 'online.gamecon.app')
            ->assertJsonPath('0.target.sha256_cert_fingerprints', [$first, strtoupper($second)]);
        $this->assertStringContainsString('max-age=3600', (string) $this->get('/.well-known/assetlinks.json')->headers->get('Cache-Control'));
    }
}
