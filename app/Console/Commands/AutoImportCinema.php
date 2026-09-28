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

    /** TMDB-статуси серіалу, які точно більше не зміняться — решта (Returning Series, In Production, Planned, Pilot, null…) ще можуть отримати нові сезони/серії. */
    private const FINISHED_STATUSES = ['Ended', 'Canceled', 'Released'];

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

        // Серіали, що ще йдуть (чи щойно анонсовані) — раз на добу перечитуємо
        // TMDB заново: новий сезон, нові серії в уже завантаженому сезоні,
        // зміна статусу (Returning Series → Ended тощо). Завершені серіали
        // й фільми більше не міняються — їх не чіпаємо.
        $refreshed = 0;
        Title::query()
            ->where('type', 'series')
            ->where(fn ($q) => $q->whereNull('status')->orWhereNotIn('status', self::FINISHED_STATUSES))
            ->where(fn ($q) => $q->whereNull('tmdb_synced_at')->orWhere('tmdb_synced_at', '<', now()->subDay()))
            ->orderBy('tmdb_synced_at')
            ->limit(self::RETRY_LIMIT)
            ->get()
            ->each(function (Title $title) use (&$refreshed) {
                try {
                    $fresh = Importer::import('series', $title->tmdb_id, attachPlayers: false);
                } catch (\Throwable) {
                    $title->forceFill(['tmdb_synced_at' => now()])->save();

                    return;
                }
                $fresh->forceFill(['tmdb_synced_at' => now()])->save();
                $refreshed++;
                // Сезони, які людина вже відкривала (episodes_loaded_at є) — теж
                // освіжити, інакше нові серії поточного сезону не з'являться,
                // доки хтось не відкриє його ще раз і не скине кеш вручну.
                $fresh->seasons()->whereNotNull('episodes_loaded_at')
                    ->where('episodes_loaded_at', '<', now()->subDay())
                    ->each(fn ($season) => Importer::importSeason($fresh, $season));
            });
        $this->info("Оновлено серіалів, що тривають: {$refreshed}");

        return self::SUCCESS;
    }
}
