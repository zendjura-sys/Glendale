<?php

namespace App\Social;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Логотип проєкту з його офіційного сайту: apple-touch-icon → найбільша
 * іконка з <link rel=icon> → og:image → /favicon.ico. Картинка
 * зберігається в себе (public disk), щоб не залежати від чужого сайту.
 */
final class ProjectLogos
{
    private const MAX_BYTES = 5 * 1024 * 1024;

    private const TYPES = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/svg+xml' => 'svg', 'image/x-icon' => 'ico', 'image/vnd.microsoft.icon' => 'ico'];

    /** Завантажити й зберегти логотип; повертає шлях або null. */
    public static function fetch(object $project): ?string
    {
        $site = self::normalize((string) $project->website);
        if ($site === null) {
            return null;
        }

        try {
            $html = self::http()->get($site);
        } catch (\Throwable) {
            return null;
        }
        $candidates = $html->successful() ? self::candidates($html->body(), (string) ($html->effectiveUri() ?? $site)) : [];
        $candidates[] = rtrim($site, '/').'/favicon.ico';

        foreach (array_unique($candidates) as $url) {
            if ($path = self::download($url, (int) $project->id)) {
                DB::table('game_projects')->where('id', $project->id)->update(['logo_path' => $path, 'updated_at' => now()]);

                return $path;
            }
        }

        return null;
    }

    /** @return list<string> URL-кандидати в порядку пріоритету. */
    public static function candidates(string $html, string $base): array
    {
        $touch = $icons = $og = [];
        preg_match_all('/<link\b[^>]*>/i', $html, $links);
        foreach ($links[0] as $tag) {
            $rel = strtolower(self::attr($tag, 'rel') ?? '');
            $href = self::attr($tag, 'href');
            if (! $href) {
                continue;
            }
            if (str_contains($rel, 'apple-touch-icon')) {
                $touch[] = [self::size($tag), $href];
            } elseif (preg_match('/(^|\s)icon(\s|$)/', $rel)) {
                $icons[] = [self::size($tag), $href];
            }
        }
        preg_match_all('/<meta\b[^>]*>/i', $html, $metas);
        foreach ($metas[0] as $tag) {
            $key = strtolower(self::attr($tag, 'property') ?? self::attr($tag, 'name') ?? '');
            if (in_array($key, ['og:image', 'og:image:url', 'twitter:image'], true) && ($c = self::attr($tag, 'content'))) {
                $og[] = [0, $c];
            }
        }
        $bySize = fn ($a, $b) => $b[0] <=> $a[0];
        usort($touch, $bySize);
        usort($icons, $bySize);

        // Маленькі favicon (16–32px) — гірші за og:image.
        $bigIcons = array_filter($icons, fn ($i) => $i[0] >= 96);
        $smallIcons = array_filter($icons, fn ($i) => $i[0] < 96);
        $ordered = [...$touch, ...$bigIcons, ...$og, ...$smallIcons];

        return array_values(array_filter(array_map(fn ($i) => self::absolute(html_entity_decode($i[1]), $base), $ordered)));
    }

    private static function download(string $url, int $projectId): ?string
    {
        if (str_starts_with($url, 'data:')) {
            return null;
        }
        try {
            $res = self::http()->get($url);
        } catch (\Throwable) {
            return null;
        }
        $body = $res->body();
        $type = strtolower(trim(explode(';', (string) $res->header('Content-Type'))[0]));
        $ext = self::TYPES[$type] ?? self::sniff($body);
        if (! $res->successful() || $ext === null || strlen($body) < 100 || strlen($body) > self::MAX_BYTES) {
            return null;
        }
        if ($ext === 'svg' && preg_match('/<script|on\w+\s*=/i', $body)) {
            return null; // SVG зі скриптами не зберігаємо
        }
        $path = 'projects/logo-'.$projectId.'-'.Str::random(8).'.'.$ext;
        Storage::disk('public')->put($path, $body);

        return $path;
    }

    private static function sniff(string $body): ?string
    {
        return match (true) {
            str_starts_with($body, "\x89PNG") => 'png',
            str_starts_with($body, "\xFF\xD8") => 'jpg',
            str_starts_with($body, 'RIFF') && substr($body, 8, 4) === 'WEBP' => 'webp',
            str_starts_with($body, 'GIF8') => 'gif',
            str_starts_with($body, "\0\0\1\0") => 'ico',
            default => null,
        };
    }

    public static function normalize(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }
        if (! preg_match('#^https?://#i', $url)) {
            $url = 'https://'.$url;
        }

        return filter_var($url, FILTER_VALIDATE_URL) ? $url : null;
    }

    private static function http(): \Illuminate\Http\Client\PendingRequest
    {
        return Http::timeout(15)->connectTimeout(8)->withUserAgent('Mozilla/5.0 (compatible; GameConnect/1.0; +https://gamecon.online)');
    }

    private static function attr(string $tag, string $name): ?string
    {
        return preg_match('/\b'.$name.'\s*=\s*("([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $tag, $m) ? ($m[2] ?? '') . ($m[3] ?? '') . ($m[4] ?? '') : null;
    }

    private static function size(string $tag): int
    {
        return preg_match('/sizes\s*=\s*["\']?(\d+)x\d+/i', $tag, $m) ? (int) $m[1] : (str_contains(strtolower($tag), 'apple-touch') ? 180 : 32);
    }

    private static function absolute(string $href, string $base): ?string
    {
        if (preg_match('#^https?://#i', $href)) {
            return $href;
        }
        $p = parse_url($base);
        if (! isset($p['scheme'], $p['host'])) {
            return null;
        }
        $origin = $p['scheme'].'://'.$p['host'].(isset($p['port']) ? ':'.$p['port'] : '');
        if (str_starts_with($href, '//')) {
            return $p['scheme'].':'.$href;
        }
        if (str_starts_with($href, '/')) {
            return $origin.$href;
        }
        $dir = isset($p['path']) ? preg_replace('#/[^/]*$#', '/', $p['path']) : '/';

        return $origin.$dir.$href;
    }
}
