<?php

namespace App\Http\Controllers;

use App\Services\Alerts\AlertWatcher;
use App\Services\Alerts\UkraineAlarm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Вебхук UkraineAlarm v3 (WebHookMessageModel: status, regionId, alarmType, createdAt, alertLevel, reason,
 * activeAlertLevels): сервер API кличе його одразу на нову тривогу, відбій чи зміну рівня.
 *
 * Запит без правильного підпису RSA SHA-256 (X-Webhook-Signature, X-Webhook-Timestamp не старший за 5 хв)
 * відхиляємо. Навіть підписане тіло — лише сигнал: стан тривог однаково беремо з GET /alerts/status і /alerts.
 */
class UkraineAlarmWebhookController extends Controller
{
    public function __invoke(Request $request, AlertWatcher $watcher, UkraineAlarm $api): JsonResponse
    {
        $check = $api->verifyWebhook(
            $request->header('X-Webhook-Signature'),
            $request->header('X-Webhook-Timestamp'),
            $request->header('X-Webhook-Signature-Alg'),
            $request->getContent(),
        );
        // Для дашборду тривог в адмінці: коли востаннє приходив вебхук і чи пройшов підпис.
        Cache::forever($check === 'ok' ? 'ua_alarm:webhook_ok' : 'ua_alarm:webhook_rejected', ['at' => now()->getTimestamp(), 'reason' => $check]);
        if ($check !== 'ok') {
            Log::warning('alerts: ukrainealarm webhook rejected', ['reason' => $check, 'key_id' => $request->header('X-Webhook-Key-Id'), 'ip' => $request->ip()]);

            return response()->json(['ok' => false, 'reason' => $check], $check === 'replay' ? 200 : 401);
        }
        $sent = $watcher->run(force: true);
        Log::info('alerts: ukrainealarm webhook', ['region' => $request->input('regionId'), 'type' => $request->input('alarmType'), 'status' => $request->input('status'), 'level' => $request->input('alertLevel'), 'sent' => $sent]);

        return response()->json(['ok' => true]);
    }
}
