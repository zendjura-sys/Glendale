<?php

use App\Console\Commands\AlertsCleanNotifications;
use Illuminate\Database\Migrations\Migration;

/**
 * Разово при деплої: прибрати старі задубльовані сповіщення про тривоги (до UkraineAlarm v3).
 * Власник попросив це явно; нові сповіщення (з alert_key) лишаються.
 */
return new class extends Migration
{
    public function up(): void
    {
        AlertsCleanNotifications::clean();
    }

    public function down(): void {}
};
