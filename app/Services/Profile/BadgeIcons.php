<?php

namespace App\Services\Profile;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Значок біля ніка — зменшена копія логотипа сім'ї, сервера чи клану (64×64, чітко на 2x-екранах).
 * Ім'я мініатюри походить від шляху логотипа: новий логотип — новий файл, тож значок змінюється сам.
 */
class BadgeIcons
{
    public const SIZE = 64;

    /** URL мініатюри для логотипа з диска public; не вдалося — сам логотип; немає — null. */
    public function url(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }
        $disk = Storage::disk('public');
        $thumb = 'badges/'.sha1($path).'.webp';
        if (! $disk->exists($thumb)) {
            try {
                if (! $disk->exists($path)) {
                    return null;
                }
                $image = (new ImageManager(new Driver))->read($disk->get($path) ?? '');
                $image->cover(self::SIZE, self::SIZE);
                $disk->put($thumb, (string) $image->toWebp(quality: 88));
            } catch (Throwable $e) {
                Log::warning('badges: thumbnail failed', ['path' => $path, 'error' => $e->getMessage()]);

                return $disk->url($path);
            }
        }

        return $disk->url($thumb);
    }

    /** Іконка з іншого сайту (Discord тощо): просимо в CDN малий розмір, якщо він це вміє. */
    public function external(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }
        $host = (string) parse_url($url, PHP_URL_HOST);
        if (in_array($host, ['cdn.discordapp.com', 'media.discordapp.net'], true)) {
            $url = (string) preg_replace('/([?&])size=\d+/', '$1size=64', $url);
            if (! str_contains($url, 'size=')) {
                $url .= (str_contains($url, '?') ? '&' : '?').'size=64';
            }
        }

        return $url;
    }
}
