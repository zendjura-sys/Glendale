<?php

namespace App\Http\Controllers;

use App\Services\Billing\GooglePlay;
use App\Services\Billing\GooglePlayException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Real-time developer notifications Google Play (Pub/Sub push-підписка на …/billing/google-play/rtdn?token=…).
 *
 * Із повідомлення беремо лише токен покупки — стан завжди перечитуємо з Google Play Developer API.
 * 2xx — повідомлення оброблено (або його не варто повторювати); 5xx — Pub/Sub надішле ще раз.
 */
class GooglePlayRtdnController extends Controller
{
    public function __invoke(Request $request, GooglePlay $play): Response
    {
        abort_unless(hash_equals($play->rtdnToken(), (string) $request->query('token', '')), 403);

        $encoded = $request->input('message.data');
        $payload = is_string($encoded) ? json_decode((string) base64_decode($encoded, true), true) : null;
        if (! is_array($payload) || ($payload['packageName'] ?? null) !== $play->package()) {
            return response()->noContent();
        }

        $subscription = $payload['subscriptionNotification'] ?? null;
        $voided = $payload['voidedPurchaseNotification'] ?? null;
        try {
            if (is_array($voided) && is_string($voided['purchaseToken'] ?? null)) {
                $play->revoke($voided['purchaseToken']);
            } elseif (is_array($subscription) && is_string($subscription['purchaseToken'] ?? null)) {
                $play->sync($subscription['purchaseToken']);
            }
        } catch (GooglePlayException $e) {
            if ($e->getCode() >= 500) {
                return response('retry', 503);
            }
            Log::info('google play rtdn: skipped', ['reason' => $e->getMessage(), 'type' => $subscription['notificationType'] ?? null]);
        }

        return response()->noContent();
    }
}
