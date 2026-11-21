<?php

namespace App\Console\Commands;

use App\Services\Alerts\AirAlertService;
use App\Support\Plugins\Plugins;
use Illuminate\Console\Command;

/** Мапа тривог: нові зведення каналів, цілі й сповіщення про тривогу та відбій. */
class AlertsSync extends Command
{
    protected $signature = 'alerts:sync';

    protected $description = 'Оновити мапу тривог і радар цілей';

    public function handle(AirAlertService $alerts, Plugins $plugins): int
    {
        if (! $plugins->on('air_alerts')) {
            return self::SUCCESS;
        }
        $result = $alerts->syncThreats();
        $this->info("Цілей: {$result['threats']}, сповіщень: {$result['notified']}");

        return self::SUCCESS;
    }
}
