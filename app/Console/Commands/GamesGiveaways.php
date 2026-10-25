<?php

namespace App\Console\Commands;

use App\Services\Games\Giveaways;
use App\Support\Plugins\Plugins;
use Illuminate\Console\Command;

/** Роздачі ігор (Epic, Steam, GOG): нові — у список і сповіщення, скінчені — з активних. */
class GamesGiveaways extends Command
{
    protected $signature = 'games:giveaways';

    protected $description = 'Оновити роздачі безкоштовних ігор';

    public function handle(Giveaways $giveaways, Plugins $plugins): int
    {
        if (! $plugins->on('game_giveaways')) {
            return self::SUCCESS;
        }
        $result = $giveaways->sync();
        if ($result === null) {
            $this->warn('GamerPower не відповів.');

            return self::SUCCESS;
        }
        $this->info("Роздач зараз: {$result['active']}, нових: {$result['new']}");

        return self::SUCCESS;
    }
}
