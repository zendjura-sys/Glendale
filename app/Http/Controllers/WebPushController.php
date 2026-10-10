<?php

namespace App\Http\Controllers;

use App\Models\WebPushSubscription;
use App\Services\Push\WebPush;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** Сповіщення сайту в браузері: ключ VAPID, підписка й відписка. */
class WebPushController extends Controller
{
    public function key(WebPush $push): JsonResponse
    {
        return response()->json(['key' => $push->publicKey()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'endpoint' => ['required', 'string', 'max:2000', 'url:https'],
            'keys.p256dh' => ['required', 'string', 'max:120'],
            'keys.auth' => ['required', 'string', 'max:40'],
        ]);
        abort_unless(WebPush::allowedEndpoint($data['endpoint']), 422, 'Цей браузер не підтримує сповіщення сайту.');
        abort_unless(strlen(WebPush::unb64($data['keys']['p256dh'])) === 65 && strlen(WebPush::unb64($data['keys']['auth'])) >= 16, 422);

        WebPushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => hash('sha256', $data['endpoint'])],
            [
                'user_id' => $request->user()->id,
                'endpoint' => $data['endpoint'],
                'p256dh' => $data['keys']['p256dh'],
                'auth' => $data['keys']['auth'],
                'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
            ],
        );

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate(['endpoint' => ['required', 'string', 'max:2000']]);
        WebPushSubscription::query()
            ->where('user_id', $request->user()->id)
            ->where('endpoint_hash', hash('sha256', $data['endpoint']))
            ->delete();

        return response()->json(['ok' => true]);
    }
}
