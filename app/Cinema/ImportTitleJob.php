<?php

namespace App\Cinema;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

/** Масовий імпорт (популярне, топ) — у черзі, по тайтлу на задачу. */
class ImportTitleJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(public string $type, public int $tmdbId) {}

    public function handle(): void
    {
        // Kodik надходить окремим потоком через cinema:kodik-sync. Старий
        // точковий пошук тут створював паралельне джерело істини й міг
        // перезаписати нормалізовані KodikSource одразу після синхронізації.
        $title = Importer::import($this->type, $this->tmdbId, attachPlayers: false);

        // Незалежні джерела лишаються частиною TMDB-імпорту.
        if ($title->category === 'anime' && ! $title->shikimori_id) {
            Shikimori::attach($title);
        }
        if (FlixCdn::configured()) {
            FlixCdn::attach($title);
        }
    }
}
