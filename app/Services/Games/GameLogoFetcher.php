<?php

namespace App\Services\Games;

use App\Models\Game;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Логотип гри для значка біля ніка — іконка застосунку, а не обкладинка:
 * App Store (офіційний iTunes Lookup, 512 px) → Google Play (іконка зі сторінки) → Steam (іконка застосунку).
 * Посилання магазинів беремо з каталогу гри (links).
 */
class GameLogoFetcher
{
    private const SIZE = 256;

    /** Повторна спроба не раніше ніж через стільки днів, якщо логотипа не знайшли. */
    public const RETRY_DAYS = 14;

    /** @return string|null джерело, з якого взято логотип */
    public function fetch(Game $game): ?string
    {
        foreach ($this->candidates($game) as [$source, $url]) {
            $binary = $this->download($url);
            if ($binary !== null && $this->store($game, $binary, $source)) {
                return $source;
            }
        }
        $game->forceFill(['logo_fetched_at' => now()])->saveQuietly();

        return null;
    }

    /** Чи варто шукати логотип: його ще немає й давно не шукали. */
    public static function due(Game $game): bool
    {
        return $game->logo_path === null && ($game->logo_fetched_at === null || $game->logo_fetched_at->lt(now()->subDays(self::RETRY_DAYS)));
    }

    /** @return iterable<array{0: string, 1: string}> */
    private function candidates(Game $game): iterable
    {
        $links = collect($game->links ?? [])->keyBy('store');
        if (preg_match('#/id(\d+)#', (string) ($links['appstore']['url'] ?? ''), $m) === 1 && ($icon = $this->appStoreIcon($m[1])) !== null) {
            yield ['appstore', $icon];
        }
        if (($url = $links['gplay']['url'] ?? null) && ($icon = $this->playIcon((string) $url)) !== null) {
            yield ['gplay', $icon];
        }
        if (($appId = $game->steamAppId()) !== null && ($icon = $this->steamIcon($appId)) !== null) {
            yield ['steam', $icon];
        }
    }

    private function appStoreIcon(string $id): ?string
    {
        try {
            $data = $this->http()->get('https://itunes.apple.com/lookup', ['id' => $id])->json();
        } catch (Throwable) {
            return null;
        }
        $item = is_array($data) ? ($data['results'][0] ?? null) : null;

        return is_array($item) ? ($item['artworkUrl512'] ?? $item['artworkUrl100'] ?? null) : null;
    }

    /** Іконка застосунку Google Play — у сторінці як itemprop="image" або og:image. */
    private function playIcon(string $url): ?string
    {
        if (! str_starts_with($url, 'https://play.google.com/')) {
            return null;
        }
        try {
            $html = Str::limit($this->http()->get($url)->body(), 600_000, '');
        } catch (Throwable) {
            return null;
        }
        if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m) === 1) {
            return html_entity_decode($m[1]);
        }

        return null;
    }

    /** Іконка застосунку Steam (публічний ICommunityService/GetApps). */
    private function steamIcon(string $appId): ?string
    {
        try {
            $data = $this->http()->get('https://api.steampowered.com/ICommunityService/GetApps/v1/', ['appids' => [$appId]])->json();
        } catch (Throwable) {
            return null;
        }
        $icon = is_array($data) ? ($data['response']['apps'][0]['icon'] ?? null) : null;

        return is_string($icon) && $icon !== '' ? "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/{$appId}/{$icon}.jpg" : null;
    }

    private function download(string $url): ?string
    {
        try {
            $response = $this->http()->get($url);
        } catch (Throwable) {
            return null;
        }
        $body = $response->body();

        return $response->successful() && strlen($body) > 100 && strlen($body) < 5_000_000 ? $body : null;
    }

    private function store(Game $game, string $binary, string $source): bool
    {
        try {
            $image = (new ImageManager(new Driver))->read($binary);
        } catch (Throwable) {
            return false;
        }
        if ($image->width() < 24 || $image->height() < 24) {
            return false;
        }
        $image->cover(min(self::SIZE, $image->width()), min(self::SIZE, $image->width()));
        $path = 'games/logos/'.Str::slug($game->slug).'-'.Str::random(8).'.webp';
        Storage::disk('public')->put($path, (string) $image->toWebp(quality: 90));
        if ($game->logo_path) {
            Storage::disk('public')->delete($game->logo_path);
        }
        $game->forceFill(['logo_path' => $path, 'logo_source' => $source, 'logo_fetched_at' => now()])->saveQuietly();
        Log::info('games: logo fetched', ['game' => $game->id, 'source' => $source]);

        return true;
    }

    private function http(): PendingRequest
    {
        return Http::timeout(6)->withHeaders(['User-Agent' => 'GameConBot/1.0 (+https://gamecon.online)', 'Accept-Language' => 'uk,en;q=0.8']);
    }
}
