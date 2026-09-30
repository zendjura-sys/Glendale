<?php

namespace App\Console\Commands;

use App\Cinema\CinemaSettings;
use App\Cinema\Kodik\KodikCatalogSynchronizer;
use Illuminate\Console\Command;
use Throwable;

class SyncKodikCinema extends Command
{
    /** @var string */
    protected $signature = 'cinema:kodik-sync
        {--mode=incremental : incremental, reconcile, missing або full}
        {--batch=100 : Кількість записів Kodik на одну сторінку}
        {--cursor= : Продовжити синхронізацію з указаного курсора}
        {--dry-run : Отримати одну сторінку без запису в БД і чергу}
        {--confirm-full : Підтвердити повну синхронізацію каталогу}';

    /** @var string */
    protected $description = 'Синхронізувати каталог і плеєри Kodik';

    /** @var list<string> */
    private const MODES = ['incremental', 'reconcile', 'missing', 'full'];

    public function handle(KodikCatalogSynchronizer $synchronizer): int
    {
        $mode = (string) $this->option('mode');
        $batch = filter_var($this->option('batch'), FILTER_VALIDATE_INT);

        if (! in_array($mode, self::MODES, true)) {
            $this->error('Невідомий режим синхронізації Kodik.');

            return self::FAILURE;
        }

        if ($batch === false || $batch < 1 || $batch > 100) {
            $this->error('Розмір сторінки має бути від 1 до 100.');

            return self::FAILURE;
        }

        if ($mode === 'full' && ! $this->option('confirm-full')) {
            $this->error('Повна синхронізація потребує прапорця --confirm-full.');

            return self::FAILURE;
        }

        $cursorOption = $this->option('cursor');
        $cursor = is_string($cursorOption) && $cursorOption !== ''
            ? $cursorOption
            : CinemaSettings::kodikCursor();

        try {
            if ($this->option('dry-run')) {
                $page = $synchronizer->preview($batch, $cursor);
                $this->info('Kodik: знайдено '.count($page->results).' записів; зміни не збережено.');

                return self::SUCCESS;
            }

            $run = $synchronizer->run($mode, $batch, $cursor, 'cli');
            $this->info(sprintf(
                'Kodik: завдання поставлено в чергу, сторінок %d, матеріалів %d. Завершення — у журналі.',
                $run->counters['pages'] ?? 0,
                $run->counters['queued'] ?? 0,
            ));

            return self::SUCCESS;
        } catch (Throwable $exception) {
            report($exception);
            $this->error('Синхронізація Kodik завершилася помилкою. Перевірте журнал синхронізації.');

            return self::FAILURE;
        }
    }
}

