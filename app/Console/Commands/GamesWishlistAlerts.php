<?php

namespace App\Console\Commands;

use App\Services\Games\WishlistAlerts;
use App\Support\Plugins\Plugins;
use Illuminate\Console\Command;

/** Знижки на ігри зі списку бажаного — сповіщення власникам. */
class GamesWishlistAlerts extends Command
{
    protected $signature = 'games:wishlist-alerts';

    protected $description = 'Перевірити знижки на ігри зі списку бажаного';

    public function handle(WishlistAlerts $alerts, Plugins $plugins): int
    {
        if (! $plugins->on('game_deals')) {
            return self::SUCCESS;
        }
        $result = $alerts->run();
        $this->info("Ігор: {$result['games']}, сповіщень: {$result['notified']}");

        return self::SUCCESS;
    }
}
