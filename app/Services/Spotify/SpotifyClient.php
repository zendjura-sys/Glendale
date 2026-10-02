<?php

namespace App\Services\Spotify;

use App\Models\SpotifyAccount;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Обгортка над Spotify Web API. Базові адреси беруться з config/services.php,
 * тож у розробці їх можна направити на локальний мок.
 */
class SpotifyClient
{
    public const SCOPES = [
        'user-read-email',
        'user-read-private',
        'streaming',
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'user-read-recently-played',
        'user-top-read',
        'user-library-read',
        'playlist-read-private',
    ];

    private const APP_TOKEN_CACHE = 'spotify.app_token';

    public function __construct(private readonly SiteSettings $settings) {}

    public function clientId(): ?string
    {
        return $this->settings->get('spotify_client_id') ?: config('services.spotify.client_id');
    }

    public function clientSecret(): ?string
    {
        return $this->settings->secret('spotify_client_secret') ?: config('services.spotify.client_secret');
    }

    public function configured(): bool
    {
        return filled($this->clientId()) && filled($this->clientSecret());
    }

    public function redirectUri(): string
    {
        return config('services.spotify.redirect') ?: route('spotify.callback');
    }

    public function authorizeUrl(string $state): string
    {
        return $this->accountsUrl('/authorize').'?'.http_build_query([
            'client_id' => $this->clientId(),
            'response_type' => 'code',
            'redirect_uri' => $this->redirectUri(),
            'scope' => implode(' ', self::SCOPES),
            'state' => $state,
            'show_dialog' => 'true',
        ]);
    }

    /**
     * @return array{access_token: string, refresh_token?: string, expires_in: int, scope?: string}
     */
    public function exchangeCode(string $code): array
    {
        return $this->tokenRequest([
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => $this->redirectUri(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function profile(string $accessToken): array
    {
        return $this->http()->withToken($accessToken)->get($this->apiUrl('/me'))->throw()->json();
    }

    public function accessToken(SpotifyAccount $account): string
    {
        if ($account->tokenExpired() && $account->refresh_token) {
            $payload = $this->tokenRequest(['grant_type' => 'refresh_token', 'refresh_token' => $account->refresh_token]);
            $account->forceFill([
                'access_token' => $payload['access_token'],
                'refresh_token' => $payload['refresh_token'] ?? $account->refresh_token,
                'expires_at' => now()->addSeconds((int) $payload['expires_in']),
            ])->save();
        }

        return $account->access_token;
    }

    /**
     * Токен застосунку (Client Credentials) для пошуку без прив'язаного акаунта.
     */
    public function appToken(): string
    {
        return Cache::remember(self::APP_TOKEN_CACHE.'.'.md5((string) $this->clientId()), now()->addMinutes(50), fn () => $this->tokenRequest(['grant_type' => 'client_credentials'])['access_token']);
    }

    public function forgetAppToken(): void
    {
        Cache::forget(self::APP_TOKEN_CACHE.'.'.md5((string) $this->clientId()));
    }

    /**
     * Перевіряє ключі застосунку в адмінці.
     */
    public function testCredentials(): bool
    {
        $this->forgetAppToken();

        try {
            return $this->appToken() !== '';
        } catch (SpotifyException) {
            return false;
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function search(string $query, ?SpotifyAccount $account = null, int $limit = 20): array
    {
        $params = ['q' => $query, 'type' => 'track', 'limit' => min(max($limit, 1), 50)];
        if ($account?->country) {
            $params['market'] = $account->country;
        }

        $response = $this->get($account, '/search', $params);

        return array_map(self::track(...), $response['tracks']['items'] ?? []);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function topTracks(SpotifyAccount $account, int $limit = 20): array
    {
        return array_map(self::track(...), $this->get($account, '/me/top/tracks', ['limit' => $limit, 'time_range' => 'short_term'])['items'] ?? []);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function recentlyPlayed(SpotifyAccount $account, int $limit = 20): array
    {
        $items = $this->get($account, '/me/player/recently-played', ['limit' => $limit])['items'] ?? [];

        return collect($items)->map(fn (array $item) => self::track($item['track']))->unique('id')->values()->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function savedTracks(SpotifyAccount $account, int $limit = 30): array
    {
        $items = $this->get($account, '/me/tracks', ['limit' => $limit])['items'] ?? [];

        return array_map(fn (array $item) => self::track($item['track']), $items);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function playlists(SpotifyAccount $account, int $limit = 30): array
    {
        $items = $this->get($account, '/me/playlists', ['limit' => $limit])['items'] ?? [];

        return collect($items)->filter()->map(fn (array $p) => [
            'id' => $p['id'],
            'uri' => $p['uri'],
            'name' => $p['name'],
            'description' => strip_tags((string) ($p['description'] ?? '')),
            'cover_url' => $p['images'][0]['url'] ?? null,
            'tracks_count' => $p['tracks']['total'] ?? $p['items']['total'] ?? 0,
            'owner' => $p['owner']['display_name'] ?? null,
            'url' => $p['external_urls']['spotify'] ?? null,
        ])->values()->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function playlistTracks(SpotifyAccount $account, string $playlistId, int $limit = 100): array
    {
        $items = $this->get($account, '/playlists/'.rawurlencode($playlistId).'/tracks', ['limit' => $limit])['items'] ?? [];

        return collect($items)
            ->map(fn (array $item) => $item['track'] ?? $item['item'] ?? null)
            ->filter(fn ($t) => is_array($t) && ($t['type'] ?? 'track') === 'track' && ! empty($t['id']))
            ->map(self::track(...))
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function currentlyPlaying(SpotifyAccount $account): ?array
    {
        $response = $this->request($account)->get($this->apiUrl('/me/player/currently-playing'));
        if ($response->status() === 204 || ! $response->successful()) {
            return null;
        }

        $item = $response->json('item');
        if (! is_array($item) || ($item['type'] ?? 'track') !== 'track') {
            return null;
        }

        return [
            ...self::track($item),
            'is_playing' => (bool) $response->json('is_playing'),
            'progress' => (int) round(((int) $response->json('progress_ms')) / 1000),
        ];
    }

    /**
     * Запускає відтворення на пристрої Web Playback SDK (лише Premium).
     *
     * @param  list<string>  $uris
     */
    public function play(SpotifyAccount $account, string $deviceId, array $uris, int $offset = 0): void
    {
        $response = $this->request($account)
            ->put($this->apiUrl('/me/player/play').'?'.http_build_query(['device_id' => $deviceId]), [
                'uris' => array_values($uris),
                'offset' => ['position' => $offset],
            ]);

        $this->ensure($response);
    }

    /**
     * Нормалізує трек Spotify до формату плеєра GameCon.
     *
     * @param  array<string, mixed>  $t
     * @return array<string, mixed>
     */
    public static function track(array $t): array
    {
        $images = $t['album']['images'] ?? [];

        return [
            'source' => 'spotify',
            'id' => $t['id'],
            'key' => 'spotify:'.$t['id'],
            'uri' => $t['uri'] ?? 'spotify:track:'.$t['id'],
            'title' => $t['name'] ?? '',
            'artist' => collect($t['artists'] ?? [])->pluck('name')->join(', '),
            'album' => $t['album']['name'] ?? null,
            'duration' => (int) round(((int) ($t['duration_ms'] ?? 0)) / 1000),
            'cover_url' => $images[1]['url'] ?? $images[0]['url'] ?? null,
            'url' => $t['external_urls']['spotify'] ?? 'https://open.spotify.com/track/'.$t['id'],
            'explicit' => (bool) ($t['explicit'] ?? false),
        ];
    }

    /**
     * Перевіряє трек Spotify, який прийшов із браузера (для «Зараз грає» та записів).
     *
     * @param  array<string, mixed>  $t
     * @return array<string, mixed>
     */
    public static function sanitize(array $t): array
    {
        $id = (string) $t['id'];
        $cover = isset($t['cover_url']) && is_string($t['cover_url']) && self::trustedImage($t['cover_url']) ? $t['cover_url'] : null;

        return [
            'source' => 'spotify',
            'id' => $id,
            'key' => 'spotify:'.$id,
            'uri' => 'spotify:track:'.$id,
            'title' => mb_substr(trim((string) $t['title']), 0, 200),
            'artist' => mb_substr(trim((string) $t['artist']), 0, 300),
            'album' => isset($t['album']) ? mb_substr(trim((string) $t['album']), 0, 200) : null,
            'duration' => (int) ($t['duration'] ?? 0),
            'cover_url' => $cover,
            'url' => 'https://open.spotify.com/track/'.$id,
            'explicit' => (bool) ($t['explicit'] ?? false),
        ];
    }

    private static function trustedImage(string $url): bool
    {
        if (preg_match('#^https://(i|mosaic|image-cdn-[a-z0-9-]+)\.(scdn\.co|spotifycdn\.com)/#', $url) === 1) {
            return true;
        }

        $apiHost = parse_url((string) config('services.spotify.api_url'), PHP_URL_HOST);

        return $apiHost !== 'api.spotify.com' && parse_url($url, PHP_URL_HOST) === $apiHost;
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    private function get(?SpotifyAccount $account, string $path, array $query = []): array
    {
        $response = $this->request($account)->get($this->apiUrl($path), $query);
        $this->ensure($response);

        return $response->json() ?? [];
    }

    private function http(): PendingRequest
    {
        return Http::withOptions([
            'curl' => [\CURLOPT_IPRESOLVE => \CURL_IPRESOLVE_V4],
        ])->acceptJson()->timeout(10);
    }

    private function request(?SpotifyAccount $account): PendingRequest
    {
        if (! $this->configured()) {
            throw new SpotifyException('Spotify не налаштовано адміністратором.', 503);
        }

        return $this->http()->withToken($account ? $this->accessToken($account) : $this->appToken());
    }

    private function ensure(Response $response): void
    {
        if ($response->successful()) {
            return;
        }

        $message = match ($response->status()) {
            401 => 'Сесія Spotify завершилася. Під’єднайте акаунт повторно.',
            403 => $response->json('error.reason') === 'PREMIUM_REQUIRED'
                ? 'Для відтворення на сайті потрібен Spotify Premium.'
                : 'Spotify відхилив запит (перевірте, чи додано вас до користувачів застосунку).',
            404 => 'Не знайдено активного пристрою Spotify.',
            429 => 'Забагато запитів до Spotify. Спробуйте за хвилину.',
            default => 'Spotify тимчасово недоступний.',
        };

        throw new SpotifyException($message, $response->status());
    }

    /**
     * @param  array<string, string>  $form
     * @return array<string, mixed>
     */
    private function tokenRequest(array $form): array
    {
        if (! $this->configured()) {
            throw new SpotifyException('Spotify не налаштовано адміністратором.', 503);
        }

        $response = $this->http()
            ->asForm()
            ->withBasicAuth((string) $this->clientId(), (string) $this->clientSecret())
            ->post($this->accountsUrl('/api/token'), $form);

        if (! $response->successful() || ! $response->json('access_token')) {
            throw new SpotifyException(
                $response->json('error') === 'invalid_client' ? 'Невірний Client ID або Client Secret Spotify.' : 'Не вдалося отримати токен Spotify.',
                $response->status() ?: 502,
            );
        }

        return $response->json();
    }

    private function accountsUrl(string $path): string
    {
        return rtrim((string) config('services.spotify.accounts_url'), '/').$path;
    }

    private function apiUrl(string $path): string
    {
        return rtrim((string) config('services.spotify.api_url'), '/').$path;
    }
}
