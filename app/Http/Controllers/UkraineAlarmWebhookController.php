<?php

namespace App\Http\Controllers;

use App\Services\Alerts\AlertWatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Вебхук UkraineAlarm v3: сервер API кличе його одразу на нову тривогу чи відбій (адресу реєструє
 * команда alerts:webhook). Тіло запиту — лише сигнал «щось змінилось»: сам стан однаково беремо з
 * GET /api/v3/alerts/status і /alerts, тож підробити тривогу через вебхук неможливо (тому й без секрету).
 */
class UkraineAlarmWebhookController extends Controller
{
    public function __invoke(Request $request, AlertWatcher $watcher): JsonResponse
    {
        $sent = $watcher->run(force: true);
        Log::info('alerts: ukrainealarm webhook', ['region' => $request->input('regionId'), 'type' => $request->input('alertType', $request->input('type')), 'status' => $request->input('status'), 'sent' => $sent]);

        return response()->json(['ok' => true]);
    }
}
