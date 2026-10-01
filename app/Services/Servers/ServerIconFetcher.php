<?php

namespace App\Services\Servers;

use App\Models\GtaServer;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Автоматично знаходить іконку сервера: Discord-інвайт → іконки сайту → Google Favicon.
 */
class ServerIconFetcher
{
    private const SIZE = 256;

    /**
     * @return string|null джерело, з якого взято іконку
     */
    public function fetch(GtaServer $server): ?string
    {
        foreach ($this->candidates($server) as [$source, $url]) {
            $binary = $this->download($url);
            if ($binary !== null && $this->store($server, $binary, $source)) {
                return $source;
            }
        }

        $server->forceFill(['icon_fetched_at' => now()])->saveQuietly();

        return null;
    }

    public function storeUpload(GtaServer $server, string $binary): bool
    {
        return $this->store($server, $binary, 'upload');
    }

    /**
     * @return iterable<array{0: string, 1: string}>
     */
    private function candidates(GtaServer $server): iterable
    {
        if ($server->icon_url && $server->icon_source !== 'upload') {
            yield ['manual', $server->icon_url];
        }

        if ($server->discord_invite && $icon = app(DiscordInvites::class)->icon($server->discord_invite)) {
            yield ['discord', $icon];
        }

        if ($server->website) {
            foreach ($this->websiteIcons($server->website) as $url) {
                yield ['website', $url];
            }

            $host = parse_url($this->normalizeUrl($server->website), PHP_URL_HOST);
            if (is_string($host)) {
                yield ['google', 'https://www.google.com/s2/favicons?domain='.$host.'&sz=128'];
            }
        }
    }

    /**
     * Іконки з HTML сторінки: apple-touch-icon і найбільші rel=icon, потім /favicon.ico.
     *
     * @return list<string>
     */
    public function websiteIcons(string $website): array
    {
        $base = $this->normalizeUrl($website);

        try {
            $response = $this->http()->get($base);
        } catch (Throwable) {
            return [];
        }

        $icons = [];
        if ($response->successful()) {
            $html = Str::limit($response->body(), 400_000, '');
            preg_match_all('/<link\b[^>]*>/i', $html, $tags);
            foreach ($tags[0] as $tag) {
                if (! preg_match('/rel=["\']([^"\']+)["\']/i', $tag, $rel) || ! preg_match('/href=["\']([^"\']+)["\']/i', $tag, $href)) {
                    continue;
                }
                $rel = strtolower($rel[1]);
                if (! str_contains($rel, 'icon')) {
                    continue;
                }
                preg_match('/sizes=["\'](\d+)x\d+["\']/i', $tag, $size);
                $score = (int) ($size[1] ?? 0) + (str_contains($rel, 'apple-touch') ? 180 : 0);
                if (str_ends_with(strtolower(strtok($href[1], '?') ?: ''), '.svg')) {
                    $score -= 1000;
                }
                $icons[$this->absolute(html_entity_decode($href[1]), (string) $response->effectiveUri() ?: $base)] = $score;
            }
        }

        arsort($icons);
        $list = array_keys($icons);
        $list[] = rtrim($base, '/').'/favicon.ico';

        return array_values(array_unique($list));
    }

    private function download(string $url): ?string
    {
        try {
            $response = $this->http()->get($url);
        } catch (Throwable) {
            return null;
        }

        if (! $response->successful() || strlen($response->body()) < 100 || strlen($response->body()) > 5_000_000) {
            return null;
        }

        return $response->body();
    }

    private function store(GtaServer $server, string $binary, string $source): bool
    {
        try {
            $image = (new ImageManager(new Driver))->read($binary);
        } catch (Throwable) {
            return false;
        }

        // Google віддає сіру «глобус»-заглушку 16×16, якщо в сайту немає іконки.
        if ($image->width() < 24 || $image->height() < 24) {
            return false;
        }

        $image->scaleDown(self::SIZE, self::SIZE);
        $path = 'gta-servers/'.Str::slug($server->slug).'-'.Str::random(8).'.webp';
        Storage::disk('public')->put($path, (string) $image->toWebp(quality: 90));

        if ($server->icon_path) {
            Storage::disk('public')->delete($server->icon_path);
        }

        $server->forceFill([
            'icon_path' => $path,
            'icon_source' => $source,
            'icon_fetched_at' => now(),
        ])->saveQuietly();

        return true;
    }

    private function normalizeUrl(string $url): string
    {
        return preg_match('#^https?://#i', $url) ? $url : 'https://'.$url;
    }

    private function absolute(string $href, string $base): string
    {
        if (preg_match('#^https?://#i', $href)) {
            return $href;
        }
        $parts = parse_url($base);
        $origin = ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? '');
        if (str_starts_with($href, '//')) {
            return ($parts['scheme'] ?? 'https').':'.$href;
        }
        if (str_starts_with($href, '/')) {
            return $origin.$href;
        }
        $dir = rtrim(preg_replace('#/[^/]*$#', '/', $parts['path'] ?? '/') ?? '/', '/');

        return $origin.$dir.'/'.$href;
    }

    private function http(): PendingRequest
    {
        return Http::withUserAgent('Mozilla/5.0 (compatible; GameConBot/1.0; +https://gamecon.online)')
            ->timeout(12)
            ->connectTimeout(6)
            ->withOptions(['allow_redirects' => ['max' => 4]]);
    }
}
