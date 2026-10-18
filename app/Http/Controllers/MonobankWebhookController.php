<?php

namespace App\Http\Controllers;

use App\Services\Billing\Checkout;
use App\Services\Billing\MonobankAcquiring;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Вебхук еквайрингу monobank: підпис X-Sign перевіряється ключем банку, повтори відкидаються (Checkout::handle).
 * 200 — прийнято (навіть якщо замовлення не наше), 400 — підпис не зійшовся (банк не повторюватиме).
 */
class MonobankWebhookController extends Controller
{
    public function __invoke(Request $request, MonobankAcquiring $monobank, Checkout $checkout): Response
    {
        $body = $request->getContent();
        if (! $monobank->verify($body, $request->header('X-Sign'))) {
            Log::warning('monobank webhook: bad signature', ['ip' => $request->ip()]);

            return response('bad signature', 400);
        }
        $data = json_decode($body, true);
        if (is_array($data)) {
            $checkout->handle($data, true);
        }

        return response('ok');
    }
}
