<?php

namespace App\Services\Music;

use Illuminate\Support\Facades\Cache;

/**
 * Спільне обмеження частоти запитів до відкритих каталогів (MusicBrainz — 1/с, Discogs — 60/хв)
 * для всіх воркерів: позначка часу останнього запиту під замком у кеші.
 */
class Throttle
{
    public static function wait(string $service, int $intervalMs): void
    {
        if ($intervalMs <= 0) {
            return;
        }
        Cache::lock('music.rate.'.$service, 10)->block(15, function () use ($service, $intervalMs) {
            $last = (float) Cache::get('music.rate.last.'.$service, 0);
            $wait = $last + $intervalMs / 1000 - microtime(true);
            if ($wait > 0) {
                usleep((int) ($wait * 1_000_000));
            }
            Cache::put('music.rate.last.'.$service, microtime(true), 60);
        });
    }
}
