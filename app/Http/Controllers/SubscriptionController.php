<?php

namespace App\Http\Controllers;

use App\Models\GtaServer;
use App\Models\User;
use App\Services\Plus\Paddle;
use App\Services\Plus\Plus;
use App\Services\Plus\ServerPromotions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Laravel\Paddle\Subscription;

/**
 * Оплата GameCon+ через Paddle Billing v2.
 *
 *  checkout() — створює транзакцію Paddle і повертає її ID («checkout transaction token»): Paddle.js
 *               відкриває оплату саме за ним, тож товар і custom_data (user_id тощо) задає сервер;
 *  status()   — поточний стан підписки (для оновлення сторінки після оплати);
 *  cancel()   — скасування в один клик: доступ лишається до кінця оплаченого періоду;
 *  resume()   — передумати до кінця періоду;
 *  portal()   — портал покупця Paddle: картки, чеки, рахунки.
 */
class SubscriptionController extends Controller
{
    public function __construct(
        private readonly Plus $plus,
        private readonly Paddle $paddle,
    ) {}

    public function checkout(Request $request, ServerPromotions $promotions): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', Rule::in(array_keys((array) config('plus.products')))],
            'username' => ['nullable', 'string', 'max:64'],
            'family_id' => ['nullable', 'integer'],
            'server_id' => ['nullable', 'integer'],
        ]);
        $user = $request->user();
        $product = (string) $data['product'];
        $kind = (string) config("plus.products.{$product}.kind");
        $custom = [];

        if ($kind === 'plus') {
            abort_if($this->plus->subscriptionFor($user)?->active(), 422, 'Підписка вже активна — керувати нею можна на сторінці GameCon+.');
            $custom['subscription_type'] = Paddle::PERSONAL;
        }
        if ($kind === 'gift') {
            $to = User::query()->where('username', ltrim((string) ($data['username'] ?? ''), '@'))->first();
            abort_if($to === null, 422, 'Людину з таким ніком не знайдено.');
            $custom['to_user_id'] = (string) $to->id;
        }
        if ($kind === 'family') {
            $family = PlusController::ledFamilies($user)->firstWhere('id', (int) ($data['family_id'] ?? 0));
            abort_if($family === null, 403, 'Підключити GameCon+ для сім’ї може лише її лідер.');
            abort_if($this->plus->subscriptionFor($family)?->active(), 422, 'У сім’ї вже є активна підписка.');
            $custom['family_id'] = (string) $family->id;
            // Cashier записує підписку з цим типом: сімейна підписка — окремо від особистої.
            $custom['subscription_type'] = 'family:'.$family->id;
        }
        if ($kind === 'promo') {
            $server = GtaServer::query()->published()->find((int) ($data['server_id'] ?? 0));
            abort_unless($server !== null && $server->owner_id === $user->id, 403, 'Просувати сервер може лише його власник.');
            $custom['server_id'] = (string) $server->id;
        }

        $transaction = $this->paddle->transaction($product, $user, $custom);
        abort_if($transaction === null, 503, 'Оплата тимчасово недоступна. Спробуйте пізніше.');

        return response()->json([
            'transaction_id' => $transaction,
            'client_token' => (string) config('cashier.client_side_token'),
            'sandbox' => $this->paddle->sandbox(),
            'starts_at' => $kind === 'promo' ? $promotions->freeAt((string) config("plus.products.{$product}.promo"))->toIso8601String() : null,
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            ...$this->plus->state($user),
            'subscribed' => $user->subscribed(Paddle::PERSONAL),
            'on_grace_period' => (bool) $user->subscription(Paddle::PERSONAL)?->onGracePeriod(),
        ]);
    }

    public function cancel(Request $request): RedirectResponse
    {
        $subscription = $this->owned($request, $request->string('type')->toString());
        $subscription->cancel();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Підписку скасовано. GameCon+ діє до кінця оплаченого періоду.']);

        return back();
    }

    public function resume(Request $request): RedirectResponse
    {
        $subscription = $this->owned($request, $request->string('type')->toString());
        abort_unless($subscription->onGracePeriod(), 422, 'Підписка не скасована.');
        $subscription->stopCancelation();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Підписку відновлено.']);

        return back();
    }

    public function portal(Request $request): RedirectResponse
    {
        $url = $this->paddle->portal($request->user());
        abort_if($url === null, 404, 'Оплат ще не було.');

        return redirect()->away($url);
    }

    /** Підписка платника: особиста («default») або сімейна («family:{id}»). */
    private function owned(Request $request, string $type): Subscription
    {
        $type = $type === '' ? Paddle::PERSONAL : $type;
        abort_unless($type === Paddle::PERSONAL || preg_match('/^family:\d+$/', $type) === 1, 422);
        $subscription = $request->user()->subscription($type);
        abort_if($subscription === null, 404, 'Підписку не знайдено.');

        return $subscription;
    }
}
