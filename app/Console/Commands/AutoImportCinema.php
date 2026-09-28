<?php

namespace App\Console\Commands;

use App\Cinema\Importer;
use App\Cinema\ImportTitleJob;
use App\Cinema\PlayerSources;
use App\Cinema\Shikimori;
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

    /**
     * Списки TMDB, які обходимо по колу — по одному за запуск (команда в
     * розкладі йде щогодини), щоб не бити ліміти API. Включно з аніме,
     * дорамами й мультфільмами — вони рідко потрапляють у загальні
     * тренди/топи, тож без окремих discover-списків не підбирались би
     * самі собою.
     */
    private const LISTS = ['trending', 'now_playing', 'popular_movies', 'popular_series', 'top_movies', 'top_series', 'anime', 'dorama', 'cartoons'];

    private const QUEUE_LIMIT = 15;

    private const RETRY_LIMIT = 30;

    public function handle(): int
    {
        if (! Tmdb::configured()) {
            $this->warn('TMDB не налаштовано — пропускаю автозаповнення.');

            return self::SUCCESS;
        }

        // Погодинний тік: за одну добу проходимо весь список категорій
        // (24 запуски на count(LISTS) списків), а сторінка зсувається на
        // кожному новому колі — інакше з часом бралася б лише перша
        // сторінка й нового контенту переставало б з'являтися.
        $tick = intdiv(now()->timestamp, 3600);
        $list = self::LISTS[$tick % count(self::LISTS)];
        $page = 1 + intdiv($tick, count(self::LISTS)) % 20;

        $queued = 0;
        try {
            foreach (Importer::browse($list, $page) as $row) {
                if ($queued >= self::QUEUE_LIMIT) {
                    break;
                }
                if (! $row['imported']) {
                    ImportTitleJob::dispatch($row['type'], $row['tmdbId']);
                    $queued++;
                }
            }
        } catch (\Throwable $e) {
            $this->warn("TMDB ({$list}, стор. {$page}) недоступний: {$e->getMessage()}");
        }
        $this->info("У черзі на імпорт ({$list}, стор. {$page}): {$queued}");

        // Раніше вимагало відсутності ОБОХ посилань — тож щойно одне
        // джерело (скажімо, FlixCDN) знаходилось, друге (Kodik) більше
        // ніколи не перевірялось, і тайтл назавжди лишався з одним
        // плеєром замість обох одночасно, де вони справді доступні.
        $retried = 0;
        Title::query()
            ->where(fn ($q) => $q->whereNull('kodik_link')->orWhereNull('flixcdn_link'))
            ->where(fn ($q) => $q
                ->whereNull('kodik_checked_at')->orWhere('kodik_checked_at', '<', now()->subDay())
                ->orWhereNull('flixcdn_checked_at')->orWhere('flixcdn_checked_at', '<', now()->subDay()))
            ->orderBy('id')
            ->limit(self::RETRY_LIMIT)
            ->get()
            ->each(function (Title $title) use (&$retried) {
                PlayerSources::autoAttach($title);
                $retried++;
            });
        $this->info("Повторний пошук плеєра: {$retried}");

        // Аніме без shikimori_id — заднім числом (імпортовані до появи цього
        // поля, або перша спроба Importer::import не знайшла точний збіг).
        $shikimoriRetried = 0;
        Title::query()
            ->where('category', 'anime')->whereNull('shikimori_id')
            ->where(fn ($q) => $q->whereNull('shikimori_checked_at')->orWhere('shikimori_checked_at', '<', now()->subDay()))
            ->orderBy('id')
            ->limit(self::RETRY_LIMIT)
            ->get()
            ->each(function (Title $title) use (&$shikimoriRetried) {
                Shikimori::attach($title);
                $shikimoriRetried++;
            });
        $this->info("Повторний пошук Shikimori ID: {$shikimoriRetried}");

        return self::SUCCESS;
    }
}
