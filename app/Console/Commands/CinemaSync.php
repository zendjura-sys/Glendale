<?php

namespace App\Console\Commands;

use App\Services\Cinema\CinemaAutoImport;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('cinema:sync {--force : Запустити, навіть якщо автонаповнення вимкнено або ще не час} {--enrich : Лише збагатити метаданими фільми без них}')]
#[Description('Автонаповнення кінокаталогу з Kodik і FlixCDN та збагачення метаданими')]
class CinemaSync extends Command
{
    public function handle(CinemaAutoImport $import): int
    {
        if (! $this->option('force') && ! $this->option('enrich') && ! $import->due()) {
            $this->line('Автонаповнення вимкнено або ще не час.');

            return self::SUCCESS;
        }

        $stats = $import->run($this->option('force') ? 'manual' : 'schedule', (bool) $this->option('enrich'));
        if ($stats === null) {
            $this->warn('Синхронізація вже виконується.');

            return self::SUCCESS;
        }

        $this->info("Нових: {$stats['created']}, оновлено: {$stats['updated']}, пропущено: {$stats['skipped']}, збагачено: {$stats['enriched']}.");
        foreach ($stats['errors'] as $error) {
            $this->error($error);
        }

        return self::SUCCESS;
    }
}
