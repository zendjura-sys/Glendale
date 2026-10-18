<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\PaymentCard;
use App\Models\PaymentOrder;
use App\Models\PlusRenewal;
use App\Services\Billing\Catalog;
use App\Services\Billing\Checkout;
use App\Services\Billing\GooglePay;
use App\Services\Billing\Shop;
use App\Services\Plus\Plus;
use App\Services\Plus\PromoCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Оплата (лише сайт): покупка карткою через monobank, збережені картки, автопродовження, історія оплат.
 */
class BillingController extends Controller
{
    public function __construct(
        private readonly Checkout $checkout,
        private readonly Catalog $catalog,
        private readonly Plus $plus,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $open = $request->integer('order') ?: null;
        if ($open !== null) {
            $order = PaymentOrder::query()->where('user_id', $user->id)->find($open);
            if ($order !== null) {
                $this->checkout->sync($order);
            }
        }

        return Inertia::render('plus/billing', [
            'orders' => PaymentOrder::query()->where('user_id', $user->id)->where('status', '!=', PaymentOrder::CANCELLED)
                ->latest('id')->limit(30)->get()->map->toCard()->values(),
            'cards' => $this->checkout->cards($user),
            'renewals' => $this->renewals($request),
            'plus' => $this->plus->state($user),
            'credit' => max(0, (int) $user->balance),
            'available' => $this->checkout->available(),
            'open' => $open,
        ]);
    }

    /**
     * Купити: замовлення → сторінка оплати monobank (redirect). Якщо ціну покрив залишок старого балансу — paid одразу.
     */
    public function purchase(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', Rule::in(array_keys($this->catalog->products()))],
            'username' => ['nullable', 'string', 'max:64'],
            'family_id' => ['nullable', 'integer'],
            'server_id' => ['nullable', 'integer'],
            'phone_operator' => ['nullable', 'string', 'size:2'],
            'phone_digits' => ['nullable', 'string', 'size:7'],
            'gift_to' => ['nullable', 'integer'],
            'renew' => ['boolean'],
            'save_card' => ['boolean'],
        ]);
        $order = $this->checkout->start($request->user(), $data['product'], $data, $request->boolean('renew'), $request->boolean('save_card'));

        return response()->json([
            'order' => $order->toCard(),
            'redirect' => $order->status === PaymentOrder::PENDING ? $order->page_url : null,
            'message' => $order->status === PaymentOrder::PAID ? $this->catalog->label($order->product).' — готово!' : null,
        ]);
    }

    /** Розрахунок для вікна оплати: ціна, знижка за промокодом, залишок старого балансу, до сплати карткою. */
    public function quote(Request $request, PromoCodes $codes): JsonResponse
    {
        $data = $request->validate(['product' => ['required', 'string', Rule::in(array_keys($this->catalog->products()))]]);
        $user = $request->user();
        $price = $this->catalog->priceFor($user, $data['product']);
        $promo = $codes->discountFor($user, $data['product'], $price);
        $credit = min(max(0, (int) $user->balance), $price - $promo['amount']);

        return response()->json([
            'price' => $price,
            'discount' => $promo['amount'],
            'promo' => $promo['redemption'] !== null ? PromoCodes::describe($promo['redemption']->code) : null,
            'credit' => $credit,
            'amount' => $price - $promo['amount'] - $credit,
            'cards' => $this->checkout->cards($user),
            'available' => $this->checkout->available(),
        ]);
    }

    /** Промокод у вікні оплати: активувати й показати нову ціну. */
    public function promo(Request $request, PromoCodes $codes): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:32'],
            'product' => ['required', 'string', Rule::in(array_keys($this->catalog->products()))],
        ]);
        $result = $codes->redeem($request->user(), $data['code'], $data['product']);
        $price = $this->catalog->priceFor($request->user(), $data['product']);

        return response()->json([
            ...$result,
            'discount' => $codes->discountFor($request->user(), $data['product'], $price)['amount'],
        ]);
    }

    public function showOrder(Request $request, PaymentOrder $order): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);

        return response()->json(['order' => $this->checkout->sync($order)->toCard()]);
    }

    /** Повернення зі сторінки оплати monobank: уточнюємо статус і відкриваємо замовлення в історії. */
    public function returned(Request $request, PaymentOrder $order): RedirectResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);
        $this->checkout->sync($order);

        return redirect('/plus/billing?order='.$order->id);
    }

    public function cancelOrder(Request $request, PaymentOrder $order): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);
        $this->checkout->cancel($order);

        return response()->json(['order' => $order->refresh()->toCard()]);
    }

    /** Нативна кнопка Google Pay: токен оплати → monobank. */
    public function googlePay(Request $request, PaymentOrder $order, GooglePay $googlePay): JsonResponse
    {
        abort_unless($order->user_id === $request->user()->id, 404);
        abort_unless($googlePay->enabled(), 404);
        $data = $request->validate(['token' => ['required', 'string', 'max:20000']]);
        $result = $this->checkout->googlePay($order, $data['token']);

        return response()->json(['order' => $result['order']->toCard(), 'redirect' => $result['tds_url']]);
    }

    public function forgetCard(Request $request, PaymentCard $card): JsonResponse
    {
        abort_unless($card->user_id === $request->user()->id, 404);
        $this->checkout->forget($card);

        return response()->json(['cards' => $this->checkout->cards($request->user()), 'renewals' => $this->renewals($request)]);
    }

    /** Увімкнути / вимкнути автопродовження свого GameCon+ або GameCon+ сім’ї й обрати картку. */
    public function renewal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'family_id' => ['nullable', 'integer'],
            'product' => ['required', 'string', Rule::in($this->catalog->renewable())],
            'active' => ['required', 'boolean'],
            'card_id' => ['nullable', 'integer'],
        ]);
        $user = $request->user();
        $owner = isset($data['family_id'])
            ? PlusController::ledFamilies($user)->firstWhere('id', (int) $data['family_id'])
            : $user;
        abort_if($owner === null, 403, 'Керувати GameCon+ сім’ї може лише її лідер.');
        abort_unless(($owner instanceof Family) === (($this->catalog->get($data['product'])['kind'] ?? null) === 'family'), 422);
        $card = isset($data['card_id']) ? PaymentCard::query()->where('user_id', $user->id)->find((int) $data['card_id']) : null;
        abort_if(isset($data['card_id']) && $card === null, 422, 'Картку не знайдено.');

        app(Shop::class)->setRenewal($user, $data['product'], $owner, (bool) $data['active'], $card?->id);

        return response()->json(['renewals' => $this->renewals($request)]);
    }

    /**
     * Автопродовження, які оплачує людина, плюс її власний GameCon+ і сім’ї, де вона лідер.
     *
     * @return array<int, array<string, mixed>>
     */
    private function renewals(Request $request): array
    {
        $user = $request->user();
        $owners = collect([$user])->concat(PlusController::ledFamilies($user));
        $rows = PlusRenewal::query()->with('card')->where('user_id', $user->id)->get();

        return $owners->map(function ($owner) use ($rows) {
            $type = $this->plus->type($owner);
            $renewal = $rows->first(fn (PlusRenewal $r) => $r->owner_type === $type && $r->owner_id === $owner->id);
            $active = $renewal !== null && $renewal->active;

            return [
                'owner_type' => $type,
                'owner_id' => $owner->id,
                'name' => $owner instanceof Family ? '['.$owner->tag.'] '.$owner->name : null,
                'until' => $owner->plus_until?->toIso8601String(),
                'product' => $renewal?->product,
                'active' => $active,
                'failed' => $active && $renewal->failed_at !== null,
                'card' => $renewal?->card?->toCard(),
            ];
        })->values()->all();
    }
}
