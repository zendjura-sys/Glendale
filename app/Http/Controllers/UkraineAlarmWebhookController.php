<?php

namespace App\Http\Controllers;

use App\Services\Alerts\AlertWatcher;
use App\Services\Alerts\UkraineAlarm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Вебхук UkraineAlarm v3: сервер API кличе його одразу на нову тривогу чи відбій (адресу реєструє
 * команда alerts:webhook). Тіло запиту — лише сигнал «щось змінилось»: сам стан однаково беремо з
 * GET /api/v3/alerts/status і /alerts, тож підробити тривогу через вебхук неможливо.
 */
class UkraineAlarmWebhookController extends Controller
{
    public function __invoke(Request $request, string $secret, AlertWatcher $watcher, UkraineAlarm $api): JsonResponse
    {
        abort_unless(hash_equals($api->webhookSecret(), $secret), 404);
        $sent = $watcher->run(force: true);
        Log::info('alerts: ukrainealarm webhook', ['region' => $request->input('regionId'), 'type' => $request->input('alertType', $request->input('type')), 'sent' => $sent]);

        return response()->json(['ok' => true]);
    }
}
