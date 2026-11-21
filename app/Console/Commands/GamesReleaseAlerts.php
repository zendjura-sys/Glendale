<?php

namespace App\Console\Commands;

use App\Services\Games\WishlistAlerts;
use App\Support\Plugins\Plugins;
use Illuminate\Console\Command;

/** Сповіщення в день виходу ігор зі списку бажаного. */
class GamesReleaseAlerts extends Command
{
    protected $signature = 'games:release-alerts';

    protected $description = 'Сповістити про вихід ігор зі списку бажаного';

    public function handle(WishlistAlerts $alerts, Plugins $plugins): int
    {
        if (! $plugins->on('release_alerts')) {
            return self::SUCCESS;
        }
        $this->info('Сповіщень: '.$alerts->releases());

        return self::SUCCESS;
    }
}
