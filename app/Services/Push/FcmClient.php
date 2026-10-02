<?php

namespace App\Services\Push;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Firebase Cloud Messaging HTTP v1. Ключ сервісного акаунта Firebase зберігається
 * зашифрованим секретом `fcm_service_account` (Адмінка → Інтеграції) або в FIREBASE_CREDENTIALS.
 */
class FcmClient
{
    public const SENT = 'sent';

    /** Токен більше не дійсний (застосунок видалено або дані очищено) — пристрій треба забути. */
    public const GONE = 'gone';

    public const FAILED = 'failed';

    private const TOKEN_CACHE = 'fcm.access_token';

    public function __construct(private readonly SiteSettings $settings) {}

    public function configured(): bool
    {
        return $this->credentials() !== null;
    }

    public function projectId(): ?string
    {
        return $this->credentials()['project_id'] ?? null;
    }

    /**
     * @return array{project_id: string, client_email: string, private_key: string, token_uri: string}|null
     */
    public function credentials(): ?array
    {
        $raw = $this->settings->secret('fcm_service_account') ?: config('services.firebase.credentials');
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }
        if (! str_starts_with(ltrim($raw), '{') && is_file($raw)) {
            $raw = (string) file_get_contents($raw);
        }

        return self::parse($raw);
    }

    /**
     * @return array{project_id: string, client_email: string, private_key: string, token_uri: string}|null
     */
    public static function parse(string $json): ?array
    {
        $data = json_decode($json, true);
        if (! is_array($data) || ($data['type'] ?? null) !== 'service_account') {
            return null;
        }
        foreach (['project_id', 'client_email', 'private_key'] as $key) {
            if (! is_string($data[$key] ?? null) || $data[$key] === '') {
                return null;
            }
        }

        return [
            'project_id' => $data['project_id'],
            'client_email' => $data['client_email'],
            'private_key' => $data['private_key'],
            'token_uri' => is_string($data['token_uri'] ?? null) ? $data['token_uri'] : 'https://oauth2.googleapis.com/token',
        ];
    }

    public function forgetAccessToken(): void
    {
        Cache::forget(self::TOKEN_CACHE);
    }

    public function testCredentials(): bool
    {
        $this->forgetAccessToken();

        return $this->accessToken() !== null;
    }

    /**
     * [$dataOnly] — без блоку `notification`: сповіщення малює сам застосунок (кнопка «Відповісти» в шторці).
     *
     * @param  array<string, string>  $data
     * @return self::SENT|self::GONE|self::FAILED
     */
    public function send(string $deviceToken, string $title, string $body, array $data = [], ?string $channel = null, ?string $tag = null, bool $dataOnly = false): string
    {
        $credentials = $this->credentials();
        $access = $this->accessToken();
        if ($credentials === null || $access === null) {
            return self::FAILED;
        }

        $android = array_filter([
            'priority' => 'HIGH',
            'notification' => array_filter([
                'channel_id' => $channel,
                'tag' => $tag,
                'icon' => 'ic_notification',
                'color' => '#6D7DFF',
            ]),
            'collapse_key' => $tag,
        ]);
        if ($dataOnly) {
            unset($android['notification']);
            $data = [...$data, 'title' => $title, 'body' => $body, 'channel' => (string) $channel];
        }

        try {
            $response = Http::timeout(10)
                ->withToken($access)
                ->post(rtrim((string) config('services.firebase.fcm_url'), '/').'/v1/projects/'.$credentials['project_id'].'/messages:send', [
                    'message' => array_filter([
                        'token' => $deviceToken,
                        'notification' => $dataOnly ? null : ['title' => $title, 'body' => $body],
                        'data' => array_map('strval', $data),
                        'android' => $android,
                        'apns' => $dataOnly ? null : ['payload' => ['aps' => array_filter(['sound' => 'default', 'thread-id' => $tag])]],
                    ]),
                ]);
        } catch (ConnectionException) {
            return self::FAILED;
        }

        if ($response->successful()) {
            return self::SENT;
        }

        $code = (string) $response->json('error.details.0.errorCode', '');
        if ($response->status() === 404 || $code === 'UNREGISTERED' || ($response->status() === 400 && $code === 'INVALID_ARGUMENT' && str_contains((string) $response->json('error.message'), 'registration token'))) {
            return self::GONE;
        }
        if ($response->status() === 401) {
            $this->forgetAccessToken();
        }

        return self::FAILED;
    }

    /**
     * OAuth2-токен сервісного акаунта (JWT, підписаний RS256), кешується до закінчення строку дії.
     */
    public function accessToken(): ?string
    {
        $cached = Cache::get(self::TOKEN_CACHE);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $credentials = $this->credentials();
        if ($credentials === null) {
            return null;
        }

        $now = time();
        $segments = [
            self::base64url((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT'])),
            self::base64url((string) json_encode([
                'iss' => $credentials['client_email'],
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud' => $credentials['token_uri'],
                'iat' => $now,
                'exp' => $now + 3600,
            ])),
        ];
        $key = openssl_pkey_get_private($credentials['private_key']);
        if ($key === false || ! openssl_sign(implode('.', $segments), $signature, $key, OPENSSL_ALGO_SHA256)) {
            return null;
        }
        $segments[] = self::base64url($signature);

        try {
            $response = Http::asForm()->timeout(10)->post($credentials['token_uri'], [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => implode('.', $segments),
            ]);
        } catch (ConnectionException) {
            return null;
        }

        $token = $response->json('access_token');
        if (! $response->successful() || ! is_string($token) || $token === '') {
            return null;
        }

        Cache::put(self::TOKEN_CACHE, $token, now()->addSeconds(max(60, (int) $response->json('expires_in', 3600) - 300)));

        return $token;
    }

    private static function base64url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
