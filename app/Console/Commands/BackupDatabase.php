<?php

namespace App\Console\Commands;

use App\Services\System\Backups;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Щоденна резервна копія бази (стан — в Адмінці → Система). */
class BackupDatabase extends Command
{
    protected $signature = 'gc:backup';

    protected $description = 'Резервна копія бази в storage/app/private/backups';

    public function handle(Backups $backups): int
    {
        try {
            $name = $backups->create();
        } catch (Throwable $e) {
            Log::error('backup: failed', ['error' => $e->getMessage()]);
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        Log::info('backup: created', ['file' => $name]);
        $this->info($name);

        return self::SUCCESS;
    }
}
