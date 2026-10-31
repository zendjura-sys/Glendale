<?php

namespace App\Console\Commands;

use App\Services\Servers\Tournaments;
use Illuminate\Console\Command;

/** Челенджі серверів відкриваються в час старту й закриваються в час завершення. */
class TournamentsTick extends Command
{
    protected $signature = 'tournaments:tick';

    protected $description = 'Відкрити й закрити челенджі серверів за розкладом';

    public function handle(Tournaments $tournaments): int
    {
        $count = $tournaments->tick();
        if ($count > 0) {
            $this->info("Оновлено челенджів: {$count}");
        }

        return self::SUCCESS;
    }
}
