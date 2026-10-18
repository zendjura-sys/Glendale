<?php

namespace App\Services\Push;

use App\Models\WebPushSubscription;
use App\Support\Settings\SiteSettings;
use Illuminate\Support\Facades\Http;
use OpenSSLAsymmetricKey;
use RuntimeException;
use Throwable;

/**
 * Web Push без сторонніх бібліотек: шифрування повідомлення (RFC 8291, aes128gcm)
 * і підпис VAPID (RFC 8292, ES256) на вбудованому OpenSSL. Ключі VAPID створюються
 * один раз і зберігаються в налаштуваннях (приватний — зашифрованим).
 */
class WebPush
{
    public const SENT = 'sent';

    public const GONE = 'gone';

    public const FAILED = 'failed';

    /** Сервіси push браузерів: шлемо лише туди, щоб адреса підписки не стала запитом у внутрішню мережу. */
    private const HOSTS = '/^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/i';

    /** Заголовок DER SubjectPublicKeyInfo для точки P-256 без стиснення. */
    private const P256_SPKI = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

    public function __construct(private readonly SiteSettings $settings) {}

    public static function allowedEndpoint(string $endpoint): bool
    {
        $parts = parse_url($endpoint);

        return is_array($parts) && ($parts['scheme'] ?? '') === 'https' && preg_match(self::HOSTS, (string) ($parts['host'] ?? '')) === 1;
    }

    /** Публічний ключ VAPID (base64url) — його браузер отримує під час підписки. */
    public function publicKey(): string
    {
        return $this->keys()['public'];
    }

    /**
     * @param  array<string, mixed>  $payload  title, body, url, tag — те, що покаже service worker
     */
    public function send(WebPushSubscription $subscription, array $payload, ?string $topic = null): string
    {
        if (! self::allowedEndpoint($subscription->endpoint)) {
            return self::GONE;
        }

        try {
            $body = $this->encrypt((string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $subscription->p256dh, $subscription->auth);
            $headers = [
                'Content-Encoding' => 'aes128gcm',
                'TTL' => '86400',
                'Urgency' => 'normal',
                'Authorization' => $this->authorization($subscription->endpoint),
            ];
            if ($topic !== null) {
                $headers['Topic'] = substr(self::b64(hash('sha256', $topic, true)), 0, 32);
            }
            $response = Http::withHeaders($headers)->timeout(10)->withBody($body, 'application/octet-stream')->post($subscription->endpoint);
        } catch (Throwable $e) {
            report($e);

            return self::FAILED;
        }

        if ($response->status() === 404 || $response->status() === 410) {
            return self::GONE;
        }

        return $response->successful() ? self::SENT : self::FAILED;
    }

    /**
     * Шифрує повідомлення для підписки (один запис aes128gcm).
     */
    public function encrypt(string $plaintext, string $p256dh, string $auth): string
    {
        $clientPublic = self::unb64($p256dh);
        $authSecret = self::unb64($auth);
        if (strlen($clientPublic) !== 65 || $clientPublic[0] !== "\x04" || strlen($authSecret) < 16) {
            throw new RuntimeException('Invalid subscription keys.');
        }

        $local = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        if (! $local instanceof OpenSSLAsymmetricKey) {
            throw new RuntimeException('Cannot create an EC key.');
        }
        $localPublic = self::rawPublic($local);
        $shared = openssl_pkey_derive(self::publicFromRaw($clientPublic), $local, 32);
        if ($shared === false) {
            throw new RuntimeException('ECDH failed.');
        }

        $ikm = self::hkdf($authSecret, $shared, "WebPush: info\x00".$clientPublic.$localPublic, 32);
        $salt = random_bytes(16);
        $cek = self::hkdf($salt, $ikm, "Content-Encoding: aes128gcm\x00", 16);
        $nonce = self::hkdf($salt, $ikm, "Content-Encoding: nonce\x00", 12);

        $tag = '';
        $cipher = openssl_encrypt($plaintext."\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
        if ($cipher === false) {
            throw new RuntimeException('Encryption failed.');
        }

        return $salt.pack('N', 4096).chr(65).$localPublic.$cipher.$tag;
    }

    /** Заголовок Authorization: vapid t=<JWT>, k=<публічний ключ>. */
    private function authorization(string $endpoint): string
    {
        $parts = (array) parse_url($endpoint);
        $keys = $this->keys();
        $header = self::b64((string) json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $claims = self::b64((string) json_encode([
            'aud' => ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? ''),
            'exp' => time() + 12 * 3600,
            'sub' => rtrim((string) config('app.url'), '/') ?: 'mailto:admin@gamecon.online',
        ], JSON_UNESCAPED_SLASHES));
        $private = openssl_pkey_get_private($keys['private']);
        if ($private === false || ! openssl_sign("{$header}.{$claims}", $der, $private, OPENSSL_ALGO_SHA256)) {
            throw new RuntimeException('VAPID signing failed.');
        }

        return 'vapid t='.$header.'.'.$claims.'.'.self::b64(self::derToRaw($der)).', k='.$keys['public'];
    }

    /**
     * @return array{public: string, private: string}
     */
    private function keys(): array
    {
        $public = $this->settings->get('vapid_public');
        $private = $this->settings->secret('vapid_private');
        if (is_string($public) && $public !== '' && $private !== null) {
            return ['public' => $public, 'private' => $private];
        }

        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        if (! $key instanceof OpenSSLAsymmetricKey || ! openssl_pkey_export($key, $pem)) {
            throw new RuntimeException('Cannot create VAPID keys.');
        }
        $public = self::b64(self::rawPublic($key));
        $this->settings->put(['vapid_public' => $public]);
        $this->settings->putSecret('vapid_private', $pem);

        return ['public' => $public, 'private' => $pem];
    }

    private static function rawPublic(OpenSSLAsymmetricKey $key): string
    {
        $details = openssl_pkey_get_details($key);
        if (! is_array($details) || ! isset($details['ec']['x'], $details['ec']['y'])) {
            throw new RuntimeException('Not an EC key.');
        }

        return "\x04".str_pad($details['ec']['x'], 32, "\x00", STR_PAD_LEFT).str_pad($details['ec']['y'], 32, "\x00", STR_PAD_LEFT);
    }

    private static function publicFromRaw(string $raw): OpenSSLAsymmetricKey
    {
        $pem = "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode(hex2bin(self::P256_SPKI).$raw), 64, "\n")."-----END PUBLIC KEY-----\n";
        $key = openssl_pkey_get_public($pem);
        if ($key === false) {
            throw new RuntimeException('Invalid public key.');
        }

        return $key;
    }

    /** HKDF-SHA256 на один блок (довжина ≤ 32). */
    private static function hkdf(string $salt, string $ikm, string $info, int $length): string
    {
        $prk = hash_hmac('sha256', $ikm, $salt, true);

        return substr(hash_hmac('sha256', $info."\x01", $prk, true), 0, $length);
    }

    /** Підпис ECDSA з DER (SEQUENCE{r, s}) у 64 байти r||s, як вимагає JWT. */
    private static function derToRaw(string $der): string
    {
        $offset = 2;
        if ((ord($der[1]) & 0x80) !== 0) {
            $offset += ord($der[1]) & 0x7F;
        }
        $parts = [];
        for ($i = 0; $i < 2; $i++) {
            $length = ord($der[$offset + 1]);
            $value = substr($der, $offset + 2, $length);
            $parts[] = str_pad(ltrim($value, "\x00"), 32, "\x00", STR_PAD_LEFT);
            $offset += 2 + $length;
        }

        return $parts[0].$parts[1];
    }

    public static function b64(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    public static function unb64(string $value): string
    {
        return (string) base64_decode(strtr($value, '-_', '+/').str_repeat('=', (4 - strlen($value) % 4) % 4), true);
    }
}
