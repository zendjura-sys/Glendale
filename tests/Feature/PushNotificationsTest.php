<?php

namespace Tests\Feature;

use App\Jobs\SendPushNotification;
use App\Models\PushDevice;
use App\Models\User;
use App\Services\Push\FcmClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PushNotificationsTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()->json('token');
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

    public function test_device_registration_and_logout_forgets_it(): void
    {
        $user = User::factory()->create();
        $token = $this->token($user);
        $fcm = str_repeat('a', 40).':device';

        $this->withToken($token)->postJson('/api/v1/push/devices', ['token' => $fcm, 'platform' => 'android'])->assertOk();
        $this->assertDatabaseHas('push_devices', ['user_id' => $user->id, 'token' => $fcm]);

        // Повторна реєстрація того ж токена не дублює пристрій.
        $this->withToken($token)->postJson('/api/v1/push/devices', ['token' => $fcm])->assertOk();
        $this->assertSame(1, PushDevice::query()->count());

        $this->withToken($token)->postJson('/api/v1/logout')->assertOk();
        $this->assertDatabaseMissing('push_devices', ['token' => $fcm]);
    }

    public function test_site_notification_is_pushed_to_the_app(): void
    {
        $this->configureFcm();
        Bus::fake([SendPushNotification::class]);

        $sender = User::factory()->create();
        $receiver = User::factory()->create();
        PushDevice::query()->create(['user_id' => $receiver->id, 'token' => str_repeat('b', 40), 'platform' => 'android']);

        $this->withToken($this->token($sender))->postJson('/api/v1/friends/'.$receiver->username)->assertOk();

        Bus::assertDispatched(SendPushNotification::class, fn (SendPushNotification $job) => $job->userId === $receiver->id
            && $job->title === $sender->name
            && $job->data['type'] === 'notification');
    }

    public function test_nothing_is_queued_without_firebase_key(): void
    {
        Bus::fake([SendPushNotification::class]);

        $sender = User::factory()->create();
        $receiver = User::factory()->create();
        PushDevice::query()->create(['user_id' => $receiver->id, 'token' => str_repeat('c', 40), 'platform' => 'android']);

        $this->withToken($this->token($sender))->postJson('/api/v1/friends/'.$receiver->username)->assertOk();

        Bus::assertNotDispatched(SendPushNotification::class);
    }

    public function test_job_sends_through_fcm_and_drops_dead_tokens(): void
    {
        $this->configureFcm();
        $user = User::factory()->create();
        $alive = PushDevice::query()->create(['user_id' => $user->id, 'token' => str_repeat('d', 40), 'platform' => 'android']);
        $dead = PushDevice::query()->create(['user_id' => $user->id, 'token' => str_repeat('e', 40), 'platform' => 'android']);

        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.test', 'expires_in' => 3600]),
            'fcm.googleapis.com/*' => function ($request) use ($dead) {
                return $request['message']['token'] === $dead->token
                    ? Http::response(['error' => ['code' => 404, 'status' => 'NOT_FOUND', 'details' => [['errorCode' => 'UNREGISTERED']]]], 404)
                    : Http::response(['name' => 'projects/gamecon-test/messages/1']);
            },
        ]);

        (new SendPushNotification($user->id, 'GameCon', 'Привіт', ['url' => '/feed'], 'activity'))->handle(app(FcmClient::class));

        $this->assertNotNull($alive->fresh()?->last_used_at);
        $this->assertNull($dead->fresh());
        Http::assertSent(fn ($request) => str_contains($request->url(), '/v1/projects/gamecon-test/messages:send')
            && $request->hasHeader('Authorization', 'Bearer ya29.test')
            && $request['message']['notification']['title'] === 'GameCon');
    }
}
