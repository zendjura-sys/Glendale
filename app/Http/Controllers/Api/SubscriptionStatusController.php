<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Billing\GooglePlay;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Статус GameCon+ для мобільного застосунку (мультиплатформний акаунт).
 *
 * Лише прапорці доступу — без цін, способів оплати, посилань на рахунок чи сайт: застосунок у Google Play
 * не має вести до зовнішньої оплати (Payments policy, anti-steering). У застосунку GameCon+ купують
 * лише через Google Play Billing; для такої підписки віддаємо посилання на керування нею в Google Play.
 */
class SubscriptionStatusController extends Controller
{
    public function __invoke(Request $request, GooglePlay $play): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $active = $user->isPlus();
        $store = $active ? $play->current($user) : null;

        return response()->json([
            'is_pro' => $active,
            'expires_at' => $active ? $user->plus_until?->toIso8601ZuluString() : null,
            'plan_name' => $active ? 'GameCon+' : null,
            // Оформлення, яке вже обрано на сайті (застосунок лише показує його).
            'style' => $active ? $user->toCard()['plus'] : null,
            // Підписка з Google Play: застосунок показує «Керувати підпискою» (скасування — лише в Google Play).
            'store' => $store !== null ? 'google_play' : null,
            'auto_renew' => $store?->auto_renew,
            'manage_url' => $store !== null ? $play->manageUrl($store) : null,
        ]);
    }
}
