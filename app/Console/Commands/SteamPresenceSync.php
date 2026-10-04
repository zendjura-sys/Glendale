<?php

namespace App\Console\Commands;

use App\Services\Presence\SteamPresence;
use Illuminate\Console\Command;

/** Статус «Граю в…» зі Steam для тих, хто прив’язав профіль. */
class SteamPresenceSync extends Command
{
    protected $signature = 'steam:presence';

    protected $description = 'Оновити статус «Граю в…» зі Steam';

    public function handle(SteamPresence $steam): int
    {
        $this->info('Зараз грають: '.$steam->sync());

        return self::SUCCESS;
    }
}
