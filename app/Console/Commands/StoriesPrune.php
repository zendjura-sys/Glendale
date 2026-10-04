<?php

namespace App\Console\Commands;

use App\Services\Stories;
use Illuminate\Console\Command;

/** Видаляє історії, яким минуло 24 години, разом із файлами. */
class StoriesPrune extends Command
{
    protected $signature = 'stories:prune';

    protected $description = 'Видалити прострочені історії';

    public function handle(Stories $stories): int
    {
        $count = $stories->prune();
        if ($count > 0) {
            $this->info("Видалено історій: {$count}");
        }

        return self::SUCCESS;
    }
}
