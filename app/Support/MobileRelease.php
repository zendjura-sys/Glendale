<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Де лежить свіжа збірка Android-застосунку (GitHub Release mobile-latest).
 *
 * Проєкт переїхав у приватний zendjura-sys/Glendale: файли його релізів
 * без токена не віддаються, тому качаємо через GitHub API з
 * GITHUB_RELEASES_TOKEN (fine-grained, Contents: read лише на Glendale).
 * Поки там немає підписаного релізу — або токен не заданий — беремо
 * збірку зі старого публічного laravel-12-railway.
 */
final class MobileRelease
{
    public const PRIVATE_REPO = 'zendjura-sys/Glendale';

    public const PUBLIC_FALLBACK = 'https://github.com/zendjura-sys/laravel-12-railway/releases/latest/download/';

    public const TAG = 'mobile-latest';

    /**
     * URL і заголовки для завантаження файлу релізу.
     *
     * @return array{url: string, headers: array<string, string>}
     */
    public static function source(string $file): array
    {
        $token = config('services.github.releases_token');
        if ($token) {
            $assetUrl = Cache::remember('mobile-release:'.$file, 300, fn () => self::privateAssetUrl($token, $file) ?? '');
            if ($assetUrl !== '') {
                return ['url' => $assetUrl, 'headers' => [
                    'Authorization' => 'Bearer '.$token,
                    'Accept' => 'application/octet-stream',
                    'X-GitHub-Api-Version' => '2022-11-28',
                ]];
            }
        }

        return ['url' => self::PUBLIC_FALLBACK.$file, 'headers' => []];
    }

    /** Завантажити файл цілком (для build.txt і деплою). */
    public static function fetch(string $file, int $timeout = 60): ?string
    {
        $src = self::source($file);
        // Guzzle не пересилає Authorization на інший хост при редиректі
        // (API → підписане посилання сховища), тож токен не витікає.
        $response = Http::timeout($timeout)->withHeaders($src['headers'])->get($src['url']);

        return $response->successful() ? $response->body() : null;
    }

    private static function privateAssetUrl(string $token, string $file): ?string
    {
        $release = Http::timeout(10)
            ->withToken($token)
            ->withHeaders(['Accept' => 'application/vnd.github+json', 'X-GitHub-Api-Version' => '2022-11-28'])
            ->get('https://api.github.com/repos/'.self::PRIVATE_REPO.'/releases/tags/'.self::TAG);
        if (! $release->successful()) {
            return null;
        }

        foreach ($release->json('assets', []) as $asset) {
            if (($asset['name'] ?? null) === $file) {
                return $asset['url'];
            }
        }

        return null;
    }
}
