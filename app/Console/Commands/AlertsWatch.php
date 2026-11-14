<?php

namespace App\Console\Commands;

use App\Services\Alerts\AlertWatcher;
use App\Support\Plugins\Plugins;
use Illuminate\Console\Command;

/**
 * Сповіщення про тривогу й відбій — кожні 10 с: один пуш на зміну стану в обраному місці,
 * лише свіжі події (до 30 с), повз загальну чергу.
 */
class AlertsWatch extends Command
{
    protected $signature = 'alerts:watch';

    protected $description = 'Перевірити зміни тривог і надіслати сповіщення';

    public function handle(AlertWatcher $watcher, Plugins $plugins): int
    {
        if (! $plugins->on('air_alerts')) {
            return self::SUCCESS;
        }
        $sent = $watcher->run();
        if ($sent > 0) {
            $this->info("Сповіщень: {$sent}");
        }

        return self::SUCCESS;
    }
}
