<?php

namespace App\Jobs;

use App\Services\Music\ArtistInfo;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Готує «Про виконавця» (фото, опис, жанри) у кеші заздалегідь, щоб картки виконавців
 * показували фото без мережевих запитів під час відкриття сторінки.
 */
class WarmArtistInfo implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $timeout = 60;

    public int $tries = 1;

    public int $uniqueFor = 3600;

    public function __construct(public readonly string $artist) {}

    public function uniqueId(): string
    {
        return md5(mb_strtolower($this->artist));
    }

    public function handle(ArtistInfo $info): void
    {
        try {
            $info->get($this->artist);
        } catch (Throwable) {
            // Немає даних — картка лишається з обкладинкою треку.
        }
    }
}
