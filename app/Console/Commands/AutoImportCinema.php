<?php

namespace App\Console\Commands;

use App\Cinema\Importer;
use App\Cinema\ImportTitleJob;
use App\Cinema\PlayerSources;
use App\Cinema\Title;
use App\Cinema\Tmdb;
use Illuminate\Console\Command;

/**
 * Автозаповнення кінопорталу: нове й популярне з TMDB — у чергу на імпорт,
 * а вже наявним тайтлам без плеєра — повторна спроба через Kodik/FlixCDN
 * (обидва балансери паралельно, з добовим тротлингом — PlayerSources::autoAttach).
 */
class AutoImportCinema extends Command
{
    protected $signature = 'cinema:auto-import';

    protected $description = 'Поповнити каталог кінопорталу новинками з TMDB і дошукати плеєри для наявних тайтлів';

    /** Списки TMDB, які обходимо по колу — по одному за запуск, щоб не бити ліміти API. */
    private const LISTS = ['trending', 'now_playing', 'popular_movies', 'popular_series', 'top_movies', 'top_series'];

    private const QUEUE_LIMIT = 15;

    private const RETRY_LIMIT = 30;

    public function handle(): int
    {
        if (! Tmdb::configured()) {
            $this->warn('TMDB не налаштовано — пропускаю автозаповнення.');

            return self::SUCCESS;
        }

        $list = self::LISTS[now()->dayOfYear % count(self::LISTS)];
        $queued = 0;
        try {
            foreach (Importer::browse($list, 1) as $row) {
                if ($queued >= self::QUEUE_LIMIT) {
                    break;
                }
                if (! $row['imported']) {
                    ImportTitleJob::dispatch($row['type'], $row['tmdbId']);
                    $queued++;
                }
            }
        } catch (\Throwable $e) {
            $this->warn("TMDB ({$list}) недоступний: {$e->getMessage()}");
        }
        $this->info("У черзі на імпорт ({$list}): {$queued}");

        $retried = 0;
        Title::query()
            ->whereNull('kodik_link')->whereNull('flixcdn_link')
            ->where(fn ($q) => $q->whereNull('kodik_checked_at')->orWhere('kodik_checked_at', '<', now()->subDay()))
            ->orderBy('id')
            ->limit(self::RETRY_LIMIT)
            ->get()
            ->each(function (Title $title) use (&$retried) {
                PlayerSources::autoAttach($title);
                $retried++;
            });
        $this->info("Повторний пошук плеєра: {$retried}");

        return self::SUCCESS;
    }
}
