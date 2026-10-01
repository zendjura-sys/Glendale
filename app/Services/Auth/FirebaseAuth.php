<?php

namespace App\Services\Auth;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class FirebaseAuth
{
    private const LEEWAY = 60;

    public function __construct(private readonly SiteSettings $settings) {}

    public function configured(): bool
    {
        return filled($this->value('api_key')) && filled($this->value('project_id'));
    }

    /**
     * Публічна конфігурація Firebase Web SDK — apiKey за задумом Google не є секретом.
     *
     * @return array{apiKey: string, authDomain: string, projectId: string, appId: string|null}|null
     */
    public function clientConfig(): ?array
    {
        if (! $this->configured()) {
            return null;
        }

        $projectId = (string) $this->value('project_id');

        return [
            'apiKey' => (string) $this->value('api_key'),
            'authDomain' => (string) ($this->value('auth_domain') ?: $projectId.'.firebaseapp.com'),
            'projectId' => $projectId,
            'appId' => $this->value('app_id'),
        ];
    }

    public function verify(string $idToken): SocialProfile
    {
        $parts = explode('.', $idToken);
        if (count($parts) !== 3) {
            throw new SocialAuthException('Некоректний токен Google.');
        }

        [$rawHeader, $rawPayload, $rawSignature] = $parts;
        $header = json_decode($this->base64UrlDecode($rawHeader), true);
        $claims = json_decode($this->base64UrlDecode($rawPayload), true);

        if (! is_array($header) || ! is_array($claims) || ($header['alg'] ?? null) !== 'RS256' || ! is_string($header['kid'] ?? null)) {
            throw new SocialAuthException('Некоректний токен Google.');
        }

        $certificate = $this->certificates()[$header['kid']] ?? null;
        $key = $certificate ? openssl_pkey_get_public($certificate) : false;
        if (! $key || openssl_verify($rawHeader.'.'.$rawPayload, $this->base64UrlDecode($rawSignature), $key, OPENSSL_ALGO_SHA256) !== 1) {
            throw new SocialAuthException('Підпис токена Google недійсний.');
        }

        $projectId = (string) $this->value('project_id');
        $now = time();

        $valid = ($claims['aud'] ?? null) === $projectId
            && ($claims['iss'] ?? null) === 'https://securetoken.google.com/'.$projectId
            && is_int($claims['exp'] ?? null) && $claims['exp'] > $now - self::LEEWAY
            && is_int($claims['iat'] ?? null) && $claims['iat'] <= $now + self::LEEWAY
            && (int) ($claims['auth_time'] ?? PHP_INT_MAX) <= $now + self::LEEWAY
            && is_string($claims['sub'] ?? null) && $claims['sub'] !== '' && strlen($claims['sub']) <= 128;

        if (! $valid) {
            throw new SocialAuthException('Сесія Google застаріла. Спробуйте ще раз.');
        }

        if (($claims['firebase']['sign_in_provider'] ?? null) !== 'google.com') {
            throw new SocialAuthException('Підтримується лише вхід через Google.');
        }

        $googleId = $claims['firebase']['identities']['google.com'][0] ?? $claims['sub'];

        return new SocialProfile(
            provider: 'google',
            id: (string) $googleId,
            email: isset($claims['email']) ? mb_strtolower((string) $claims['email']) : null,
            emailVerified: (bool) ($claims['email_verified'] ?? false),
            name: (string) ($claims['name'] ?? ''),
            avatarUrl: isset($claims['picture']) ? preg_replace('/=s\d+-c$/', '=s512-c', (string) $claims['picture']) : null,
        );
    }

    /**
     * Перевірка API-ключа: Identity Toolkit повертає projectId, до якого належить ключ.
     */
    public function testCredentials(): bool
    {
        try {
            $response = Http::timeout(10)->get('https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig', [
                'key' => $this->value('api_key'),
            ]);
        } catch (ConnectionException) {
            return false;
        }

        return $response->successful() && $response->json('projectId') === $this->value('project_id');
    }

    /**
     * @return array<string, string>
     */
    private function certificates(): array
    {
        $cached = Cache::get('firebase.certs');
        if (is_array($cached)) {
            return $cached;
        }

        try {
            $response = Http::timeout(10)->get((string) config('services.firebase.certs_url'));
        } catch (ConnectionException) {
            throw new SocialAuthException('Google не відповідає. Спробуйте пізніше.');
        }

        $certs = $response->successful() ? $response->json() : null;
        if (! is_array($certs) || $certs === []) {
            throw new SocialAuthException('Google не відповідає. Спробуйте пізніше.');
        }

        preg_match('/max-age=(\d+)/', (string) $response->header('Cache-Control'), $m);
        Cache::put('firebase.certs', $certs, now()->addSeconds(max(300, (int) ($m[1] ?? 3600))));

        return $certs;
    }

    private function value(string $key): ?string
    {
        return $this->settings->get('firebase_'.$key) ?: config('services.firebase.'.$key);
    }

    private function base64UrlDecode(string $value): string
    {
        return (string) base64_decode(strtr($value, '-_', '+/').str_repeat('=', (4 - strlen($value) % 4) % 4), true);
    }
}
