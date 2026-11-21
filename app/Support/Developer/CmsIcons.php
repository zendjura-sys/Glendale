<?php

namespace App\Support\Developer;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Логотипи рушіїв у каталозі плагінів — фавікони з їхніх офіційних сайтів.
 * Сервер завантажує їх сам (команда developers:cms-icons) і зберігає в storage/app/public/cms-icons,
 * щоб браузери відвідувачів не ходили на чужі сайти. Поки фавікона немає — логотип або монограма.
 */
class CmsIcons
{
    private const DIR = 'cms-icons';

    private const MAX_BYTES = 512 * 1024;

    private const TYPES = ['image/svg+xml' => 'svg', 'image/png' => 'png', 'image/x-icon' => 'ico', 'image/vnd.microsoft.icon' => 'ico', 'image/webp' => 'webp', 'image/jpeg' => 'jpg'];

    public static function url(string $key): ?string
    {
        $disk = Storage::disk('public');
        foreach (array_unique(self::TYPES) as $ext) {
            $path = self::DIR.'/'.$key.'.'.$ext;
            if ($disk->exists($path)) {
                return '/storage/'.$path.'?v='.$disk->lastModified($path);
            }
        }

        return null;
    }

    /** Завантажити фавікон рушія; true — збережено. */
    public static function fetch(string $key, string $site): bool
    {
        try {
            $html = Http::timeout(15)->withUserAgent('Mozilla/5.0 (compatible; GameConBot/1.0; +https://gamecon.online)')->get($site)->body();
        } catch (Throwable $e) {
            Log::warning('cms-icons.site', ['key' => $key, 'error' => $e->getMessage()]);

            return false;
        }
        foreach (self::candidates($html, $site) as $url) {
            try {
                $response = Http::timeout(15)->withUserAgent('Mozilla/5.0 (compatible; GameConBot/1.0)')->get($url);
            } catch (Throwable) {
                continue;
            }
            $type = strtolower(trim(explode(';', (string) $response->header('Content-Type'))[0]));
            $body = $response->body();
            $ext = self::TYPES[$type] ?? (str_starts_with($body, "\x89PNG") ? 'png' : null);
            if (! $response->successful() || $ext === null || $body === '' || strlen($body) > self::MAX_BYTES) {
                continue;
            }
            // SVG без скриптів і зовнішніх посилань.
            if ($ext === 'svg' && preg_match('/<script|on\w+\s*=|javascript:|<foreignObject/i', $body)) {
                continue;
            }
            $disk = Storage::disk('public');
            foreach (array_unique(self::TYPES) as $old) {
                $disk->delete(self::DIR.'/'.$key.'.'.$old);
            }
            $disk->put(self::DIR.'/'.$key.'.'.$ext, $body);

            return true;
        }

        return false;
    }

    /**
     * Іконки зі сторінки від найкращої: SVG, найбільший розмір, apple-touch-icon, /favicon.ico.
     *
     * @return list<string>
     */
    private static function candidates(string $html, string $site): array
    {
        $found = [];
        preg_match_all('/<link\b[^>]*>/i', $html, $links);
        foreach ($links[0] as $tag) {
            if (! preg_match('/rel=["\']([^"\']+)/i', $tag, $rel) || ! str_contains(strtolower($rel[1]), 'icon') || str_contains(strtolower($rel[1]), 'mask')) {
                continue;
            }
            if (! preg_match('/href=["\']([^"\']+)/i', $tag, $href)) {
                continue;
            }
            $url = self::absolute(html_entity_decode($href[1]), $site);
            $size = preg_match('/sizes=["\'](\d+)/i', $tag, $m) ? (int) $m[1] : (str_contains(strtolower($rel[1]), 'apple') ? 180 : 32);
            $score = (str_ends_with(strtolower(parse_url($url, PHP_URL_PATH) ?? ''), '.svg') ? 1000 : 0) + min($size, 512);
            $found[$url] = max($found[$url] ?? 0, $score);
        }
        arsort($found);

        return [...array_keys($found), self::absolute('/favicon.ico', $site)];
    }

    private static function absolute(string $href, string $site): string
    {
        if (preg_match('#^https?://#i', $href)) {
            return $href;
        }
        $parts = parse_url($site);
        $root = ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? '');
        if (str_starts_with($href, '//')) {
            return ($parts['scheme'] ?? 'https').':'.$href;
        }

        return $root.(str_starts_with($href, '/') ? $href : '/'.$href);
    }
}
