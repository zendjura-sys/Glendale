<?php

namespace App\Console\Commands;

use App\Services\Events\DiscordEventSync;
use App\Services\Events\GameEventSync;
use Illuminate\Console\Command;

class EventsSync extends Command
{
    protected $signature = 'events:sync {--games : Лише події ігор (IGDB)} {--servers : Лише події серверів (Discord)}';

    protected $description = 'Підтягує події ігор з IGDB і події серверів із Discord у календар';

    public function handle(GameEventSync $games, DiscordEventSync $servers): int
    {
        $all = ! $this->option('games') && ! $this->option('servers');
        if ($all || $this->option('games')) {
            $result = $games->sync();
            $this->info("Ігри: подій {$result['events']}, виходів {$result['releases']}.");
        }
        if ($all || $this->option('servers')) {
            $result = $servers->sync();
            $this->info("Сервери: Discord із ботом {$result['servers']}, подій {$result['events']}.");
        }

        return self::SUCCESS;
    }
}
