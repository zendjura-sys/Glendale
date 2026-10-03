<?php

namespace App\Services\Voice;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Сервер голосу LiveKit: токени доступу до кімнат, перевірка вебхуків і керування учасниками.
 * Ключі — в адмінці (Інтеграції → Голосові кімнати) або в .env (LIVEKIT_*).
 */
class LiveKit
{
    /** Скільки живе токен входу: лише для підключення, далі LiveKit тримає з’єднання сам. */
    public const TOKEN_TTL = 6 * 3600;

    public function __construct(private readonly SiteSettings $settings) {}

    public function configured(): bool
    {
        return $this->url() !== null && $this->key() !== null && $this->secret() !== null;
    }

    /** Публічна адреса для клієнтів (wss://…). */
    public function url(): ?string
    {
        $value = $this->settings->get('livekit_url') ?: config('services.livekit.url');

        return is_string($value) && preg_match('#\Awss?://#i', $value) === 1 ? rtrim($value, '/') : null;
    }

    public function key(): ?string
    {
        $value = $this->settings->get('livekit_api_key') ?: config('services.livekit.key');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function secret(): ?string
    {
        $value = $this->settings->secret('livekit_api_secret') ?? config('services.livekit.secret');

        return is_string($value) && $value !== '' ? $value : null;
    }

    /** HTTP-адреса API сервера (той самий хост, що й wss). */
    public function apiUrl(): ?string
    {
        $url = $this->url();

        return $url === null ? null : (string) preg_replace('#\Aws(s?)://#i', 'http$1://', $url);
    }

    /**
     * Токен входу в кімнату.
     *
     * @param  array<string, mixed>  $grant  додаткові права (canPublish тощо)
     */
    public function token(string $identity, string $name, string $room, array $grant = [], ?string $metadata = null): string
    {
        $now = time();

        return $this->sign(array_filter([
            'iss' => $this->key(),
            'sub' => $identity,
            'name' => $name,
            'nbf' => $now - 10,
            'exp' => $now + self::TOKEN_TTL,
            'metadata' => $metadata,
            'video' => [
                'room' => $room,
                'roomJoin' => true,
                'canPublish' => true,
                'canSubscribe' => true,
                'canPublishData' => true,
                'canPublishSources' => ['microphone'],
                ...$grant,
            ],
        ], fn ($v) => $v !== null));
    }

    /**
     * Перевіряє вебхук LiveKit: заголовок Authorization — JWT, підписаний нашим секретом,
     * з хешем тіла в полі sha256. Повертає розібране тіло або null.
     *
     * @return array<string, mixed>|null
     */
    public function webhook(string $body, ?string $authorization): ?array
    {
        $secret = $this->secret();
        if ($secret === null || $authorization === null || $authorization === '') {
            return null;
        }

        $token = preg_replace('/^Bearer\s+/i', '', trim($authorization));
        $claims = $this->verify((string) $token, $secret);
        if ($claims === null || ($claims['iss'] ?? null) !== $this->key()) {
            return null;
        }

        $hash = base64_encode(hash('sha256', $body, true));
        if (! is_string($claims['sha256'] ?? null) || ! hash_equals($claims['sha256'], $hash)) {
            return null;
        }

        $data = json_decode($body, true);

        return is_array($data) ? $data : null;
    }

    /** Вимикає учаснику мікрофон (і не дає ввімкнути, доки модератор не дозволить). */
    public function setCanPublish(string $room, string $identity, bool $allowed): bool
    {
        return $this->call('UpdateParticipant', $room, [
            'room' => $room,
            'identity' => $identity,
            'permission' => [
                'canPublish' => $allowed,
                'canSubscribe' => true,
                'canPublishData' => true,
                'canPublishSources' => $allowed ? ['MICROPHONE'] : [],
            ],
        ]);
    }

    public function removeParticipant(string $room, string $identity): bool
    {
        return $this->call('RemoveParticipant', $room, ['room' => $room, 'identity' => $identity]);
    }

    public function deleteRoom(string $room): bool
    {
        return $this->call('DeleteRoom', $room, ['room' => $room]);
    }

    /** Перевірка ключів з адмінки: список кімнат має відповісти 200. */
    public function test(): bool
    {
        return $this->call('ListRooms', null, []);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function call(string $method, ?string $room, array $payload): bool
    {
        $api = $this->apiUrl();
        if ($api === null || ! $this->configured()) {
            return false;
        }

        $admin = $this->sign([
            'iss' => $this->key(),
            'nbf' => time() - 10,
            'exp' => time() + 60,
            'video' => array_filter(['roomAdmin' => true, 'roomList' => $room === null ? true : null, 'roomCreate' => true, 'room' => $room]),
        ]);

        try {
            return Http::timeout(8)
                ->withToken($admin)
                ->asJson()
                ->post($api.'/twirp/livekit.RoomService/'.$method, (object) $payload)
                ->successful();
        } catch (ConnectionException) {
            return false;
        }
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    private function sign(array $claims): string
    {
        $segments = [
            $this->base64url((string) json_encode(['alg' => 'HS256', 'typ' => 'JWT'])),
            $this->base64url((string) json_encode($claims, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)),
        ];
        $segments[] = $this->base64url(hash_hmac('sha256', implode('.', $segments), (string) $this->secret(), true));

        return implode('.', $segments);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function verify(string $token, string $secret): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        $expected = $this->base64url(hash_hmac('sha256', $parts[0].'.'.$parts[1], $secret, true));
        if (! hash_equals($expected, $parts[2])) {
            return null;
        }

        $claims = json_decode($this->decode($parts[1]), true);
        if (! is_array($claims)) {
            return null;
        }

        $now = time();
        if ((isset($claims['exp']) && (int) $claims['exp'] < $now - 60) || (isset($claims['nbf']) && (int) $claims['nbf'] > $now + 60)) {
            return null;
        }

        return $claims;
    }

    private function base64url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function decode(string $value): string
    {
        return (string) base64_decode(strtr($value, '-_', '+/'));
    }
}
