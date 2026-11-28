<?php

namespace App\Console\Commands;

use App\Notifications\AirAlertNotice;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Прибрати з дзвіночка старі задубльовані сповіщення про тривоги (до переходу на UkraineAlarm v3:
 * «тривога — відбій» щохвилини). Нові записи мають alert_key і не чіпаються.
 */
class AlertsCleanNotifications extends Command
{
    protected $signature = 'alerts:clean-notifications';

    protected $description = 'Видалити старі дублі сповіщень про тривоги';

    public function handle(): int
    {
        $deleted = self::clean();
        Log::info('alerts: old alert notifications removed', ['count' => $deleted]);
        $this->info("Видалено: {$deleted}");

        return self::SUCCESS;
    }

    public static function clean(): int
    {
        return DB::table('notifications')
            ->where('type', AirAlertNotice::class)
            ->where('data', 'not like', '%"alert_key"%')
            ->delete();
    }
}
