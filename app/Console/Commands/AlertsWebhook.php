<?php

namespace App\Console\Commands;

use App\Services\Alerts\UkraineAlarm;
use Illuminate\Console\Command;

/** Вебхук UkraineAlarm v3: POST (підписка), PATCH (--update) чи DELETE (--delete) /api/v3/webhook з webHookUrl. */
class AlertsWebhook extends Command
{
    protected $signature = 'alerts:webhook {--update : Оновити адресу (PATCH)} {--delete : Прибрати вебхук}';

    protected $description = 'Зареєструвати вебхук UkraineAlarm для миттєвих тривог';

    public function handle(UkraineAlarm $api): int
    {
        if (! $api->enabled()) {
            $this->error('Немає ключа UkraineAlarm (UKRAINE_ALARM_KEY або Адмінка → Інтеграції).');

            return self::FAILURE;
        }
        $ok = $this->option('delete') ? $api->deleteWebhook() : $api->registerWebhook((bool) $this->option('update'));
        $ok ? $this->info('Готово: '.$api->webhookUrl()) : $this->error('UkraineAlarm не прийняв запит.');

        return $ok ? self::SUCCESS : self::FAILURE;
    }
}
