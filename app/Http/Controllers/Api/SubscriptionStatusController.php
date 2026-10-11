<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Статус GameCon+ для мобільного застосунку (мультиплатформний акаунт).
 *
 * Лише прапорці доступу — без цін, способів оплати, посилань на рахунок чи сайт: застосунок у Google Play
 * не має вести до зовнішньої оплати (Payments policy, anti-steering). Купують GameCon+ лише на сайті.
 */
class SubscriptionStatusController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $active = $user->isPlus();

        return response()->json([
            'is_pro' => $active,
            'expires_at' => $active ? $user->plus_until?->toIso8601ZuluString() : null,
            'plan_name' => $active ? 'GameCon+' : null,
            // Оформлення, яке вже обрано на сайті (застосунок лише показує його).
            'style' => $active ? $user->toCard()['plus'] : null,
        ]);
    }
}
