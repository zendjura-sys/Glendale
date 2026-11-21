<?php

namespace App\Http\Controllers;

use App\Models\LivecastIntegration;
use App\Services\LiveCast\DonationInbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Колбеки Donatik / Donatello → повідомлення в чат живого LiveCast.
 * Donatello: заголовок X-Key; Donatik: Bearer / X-Key / ?key=.
 */
class LiveCastDonationWebhookController extends Controller
{
    public function __invoke(Request $request, string $provider, string $hook, DonationInbox $inbox): JsonResponse
    {
        if (! in_array($provider, [LivecastIntegration::DONATIK, LivecastIntegration::DONATELLO], true)) {
            return response()->json(['message' => 'Unknown provider'], 404);
        }

        $integration = LivecastIntegration::query()
            ->where('provider', $provider)
            ->where('hook_id', $hook)
            ->first();
        if ($integration === null) {
            return response()->json(['message' => 'Unknown webhook'], 404);
        }

        $key = $request->header('X-Key')
            ?? $request->header('X-Api-Key')
            ?? $request->bearerToken()
            ?? $request->query('key');
        if (! $inbox->verifyKey($integration, is_string($key) ? $key : null, $request->bearerToken(), is_string($request->query('key')) ? $request->query('key') : null)) {
            Log::warning('livecast donation webhook: bad key', ['provider' => $provider, 'hook' => $hook]);

            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $body = $request->all();
        if ($body === []) {
            $decoded = json_decode($request->getContent(), true);
            $body = is_array($decoded) ? $decoded : [];
        }
        // Іноді Donatello шле обгортку { data: {...} }.
        if (isset($body['data']) && is_array($body['data'])) {
            $body = $body['data'];
        }

        $donation = DonationInbox::fromWebhook($provider, $body);
        if ($donation === null) {
            return response()->json(['message' => 'Ignored'], 200);
        }

        $msg = $inbox->publish($integration->user, $donation);

        // Donatello очікує саме цей текст на успіх.
        return response()->json([
            'message' => 'Donation processed',
            'posted' => $msg !== null,
        ]);
    }
}
