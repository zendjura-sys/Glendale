<?php

namespace Tests\Feature;

use App\Jobs\SendPushNotification;
use App\Models\User;
use App\Models\WebPushSubscription;
use App\Services\Push\FcmClient;
use App\Services\Push\WebPush;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use OpenSSLAsymmetricKey;
use Tests\TestCase;

class WebPushTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Ключі браузера, як у PushSubscription: p256dh (точка P-256) і auth.
     *
     * @return array{OpenSSLAsymmetricKey, string, string}
     */
    private function browserKeys(): array
    {
        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        $this->assertInstanceOf(OpenSSLAsymmetricKey::class, $key);
        $ec = openssl_pkey_get_details($key)['ec'];
        $public = "\x04".str_pad($ec['x'], 32, "\x00", STR_PAD_LEFT).str_pad($ec['y'], 32, "\x00", STR_PAD_LEFT);

        return [$key, WebPush::b64($public), WebPush::b64(random_bytes(16))];
    }

    /** Розшифровка так, як це робить браузер (RFC 8291). */
    private function decrypt(string $body, OpenSSLAsymmetricKey $browserKey, string $p256dh, string $auth): string
    {
        $salt = substr($body, 0, 16);
        $this->assertSame(4096, unpack('N', substr($body, 16, 4))[1]);
        $this->assertSame(65, ord($body[20]));
        $serverPublic = substr($body, 21, 65);
        $cipher = substr($body, 86, -16);
        $tag = substr($body, -16);

        $pem = "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode(hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200').$serverPublic), 64, "\n")."-----END PUBLIC KEY-----\n";
        $shared = openssl_pkey_derive(openssl_pkey_get_public($pem), $browserKey, 32);
        $hkdf = fn (string $salt, string $ikm, string $info, int $length) => substr(hash_hmac('sha256', $info."\x01", hash_hmac('sha256', $ikm, $salt, true), true), 0, $length);
        $ikm = $hkdf(WebPush::unb64($auth), $shared, "WebPush: info\x00".WebPush::unb64($p256dh).$serverPublic, 32);
        $cek = $hkdf($salt, $ikm, "Content-Encoding: aes128gcm\x00", 16);
        $nonce = $hkdf($salt, $ikm, "Content-Encoding: nonce\x00", 12);
        $plain = openssl_decrypt($cipher, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
        $this->assertIsString($plain);
        $this->assertSame("\x02", substr($plain, -1));

        return substr($plain, 0, -1);
    }

    public function test_browser_subscribes_and_receives_an_encrypted_signed_notification(): void
    {
        $user = User::factory()->create();
        [$browserKey, $p256dh, $auth] = $this->browserKeys();
        $endpoint = 'https://fcm.googleapis.com/fcm/send/abc123';

        $key = $this->actingAs($user)->getJson(route('web-push.key'))->assertOk()->json('key');
        $this->assertSame(65, strlen(WebPush::unb64($key)));
        // Ключ створюється один раз; приватна частина не віддається.
        $this->assertSame($key, $this->actingAs($user)->getJson(route('web-push.key'))->json('key'));

        $this->actingAs($user)->postJson(route('web-push.store'), ['endpoint' => 'https://169.254.169.254/latest', 'keys' => ['p256dh' => $p256dh, 'auth' => $auth]])->assertStatus(422);
        $this->actingAs($user)->postJson(route('web-push.store'), ['endpoint' => $endpoint, 'keys' => ['p256dh' => $p256dh, 'auth' => $auth]])->assertOk();
        $this->assertSame(1, WebPushSubscription::query()->count());

        Http::fake([$endpoint => Http::response('', 201)]);
        (new SendPushNotification($user->id, 'Олена', 'Вподобала ваш запис', ['url' => '/posts/5'], 'activity', 'post-5'))->handle(app(FcmClient::class), app(WebPush::class));

        Http::assertSent(function (ClientRequest $request) use ($endpoint, $browserKey, $p256dh, $auth, $key) {
            $this->assertSame($endpoint, $request->url());
            $this->assertSame('aes128gcm', $request->header('Content-Encoding')[0]);
            $payload = json_decode($this->decrypt($request->body(), $browserKey, $p256dh, $auth), true);
            $this->assertSame('Олена', $payload['title']);
            $this->assertSame('/posts/5', $payload['url']);

            // VAPID: JWT для https://fcm.googleapis.com, підписаний ключем, який отримав браузер.
            $this->assertMatchesRegularExpression('/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/', $request->header('Authorization')[0]);
            preg_match('/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/', $request->header('Authorization')[0], $m);
            $this->assertSame($key, $m[4]);
            $this->assertSame('https://fcm.googleapis.com', json_decode(WebPush::unb64($m[2]), true)['aud']);
            $raw = WebPush::unb64($m[3]);
            $der = fn (string $int) => "\x02".chr(strlen($int = (ord($int[0]) & 0x80 ? "\x00" : '').ltrim($int, "\x00") ?: "\x00")).$int;
            $sequence = $der(substr($raw, 0, 32)).$der(substr($raw, 32));
            $pem = "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode(hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200').WebPush::unb64($key)), 64, "\n")."-----END PUBLIC KEY-----\n";
            $this->assertSame(1, openssl_verify($m[1].'.'.$m[2], "\x30".chr(strlen($sequence)).$sequence, $pem, OPENSSL_ALGO_SHA256));

            return true;
        });
        $this->assertNotNull(WebPushSubscription::query()->sole()->last_used_at);
    }

    public function test_expired_subscriptions_are_removed_and_users_can_unsubscribe(): void
    {
        $user = User::factory()->create();
        [, $p256dh, $auth] = $this->browserKeys();
        $endpoint = 'https://updates.push.services.mozilla.com/wpush/v2/xyz';
        $this->actingAs($user)->postJson(route('web-push.store'), ['endpoint' => $endpoint, 'keys' => ['p256dh' => $p256dh, 'auth' => $auth]])->assertOk();

        Http::fake([$endpoint => Http::response('', 410)]);
        (new SendPushNotification($user->id, 'GameCon', 'Тест', [], 'activity'))->handle(app(FcmClient::class), app(WebPush::class));
        $this->assertSame(0, WebPushSubscription::query()->count());

        $this->actingAs($user)->postJson(route('web-push.store'), ['endpoint' => $endpoint, 'keys' => ['p256dh' => $p256dh, 'auth' => $auth]])->assertOk();
        $this->actingAs(User::factory()->create())->deleteJson(route('web-push.destroy'), ['endpoint' => $endpoint])->assertOk();
        $this->assertSame(1, WebPushSubscription::query()->count());
        $this->actingAs($user)->deleteJson(route('web-push.destroy'), ['endpoint' => $endpoint])->assertOk();
        $this->assertSame(0, WebPushSubscription::query()->count());
    }
}
