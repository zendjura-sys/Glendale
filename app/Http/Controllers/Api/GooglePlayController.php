<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Billing\GooglePlay;
use App\Services\Billing\GooglePlayException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Покупка GameCon+ у застосунку через Google Play Billing.
 *
 * Ціни, назви й періоди застосунок бере з Google Play (ProductDetails), а не з сервера: сервер віддає лише
 * ID підписок і ідентифікатор акаунта для obfuscatedAccountId. Жодних посилань на оплату на сайті.
 */
class GooglePlayController extends Controller
{
    public function __construct(private readonly GooglePlay $play) {}

    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $enabled = $this->play->enabled();

        return response()->json([
            'enabled' => $enabled,
            'products' => $enabled ? $this->play->products() : [],
            'account_id' => $enabled ? $this->play->accountId($user) : null,
        ]);
    }

    /** Застосунок отримав покупку від Google Play — перевіряємо її на сервері й вмикаємо GameCon+. */
    public function verify(Request $request): JsonResponse
    {
        abort_unless($this->play->enabled(), 404);
        $data = $request->validate([
            'purchase_token' => ['required', 'string', 'min:10', 'max:4000'],
            'product_id' => ['nullable', 'string', 'max:64'],
        ]);
        /** @var User $user */
        $user = $request->user();

        try {
            $subscription = $this->play->sync($data['purchase_token'], $user);
        } catch (GooglePlayException $e) {
            abort($e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 422, $e->getMessage());
        }
        $user->refresh();

        return response()->json([
            'is_pro' => $user->isPlus(),
            'expires_at' => $user->isPlus() ? $user->plus_until?->toIso8601ZuluString() : null,
            'status' => $subscription->status,
            'acknowledged' => $subscription->acknowledged_at !== null,
        ]);
    }
}
