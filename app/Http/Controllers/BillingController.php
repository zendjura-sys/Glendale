<?php

namespace App\Http\Controllers;

use App\Models\Family;
use App\Models\PlusRenewal;
use App\Models\WalletTopup;
use App\Models\WalletTransaction;
use App\Services\Billing\InsufficientFunds;
use App\Services\Billing\Shop;
use App\Services\Billing\TopUps;
use App\Services\Billing\Wallet;
use App\Services\Plus\Plus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Білінг (лише сайт): особистий рахунок, поповнення донатом, покупки з рахунку й автопродовження.
 */
class BillingController extends Controller
{
    public function __construct(
        private readonly TopUps $topups,
        private readonly Shop $shop,
        private readonly Plus $plus,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('plus/billing', [
            'balance' => (int) $user->balance,
            'methods' => $this->topups->methods(),
            'limits' => ['min' => TopUps::MIN, 'max' => TopUps::MAX],
            'topups' => WalletTopup::query()->where('user_id', $user->id)
                ->where(fn ($q) => $q->where('status', WalletTopup::PENDING)->orWhere('created_at', '>=', now()->subDays(30)))
                ->latest('id')->limit(20)->get()->map->toCard()->values(),
            'transactions' => WalletTransaction::query()->where('user_id', $user->id)->latest('id')->limit(50)->get()->map->toCard()->values(),
            'renewals' => $this->renewals($request),
            'plus' => $this->plus->state($user),
            'open' => $request->integer('topup') ?: null,
        ]);
    }

    public function storeTopup(Request $request): JsonResponse
    {
        $data = $request->validate(['amount' => ['required', 'integer', 'min:'.TopUps::MIN, 'max:'.TopUps::MAX]]);
        $topup = $this->topups->create($request->user(), (int) $data['amount']);

        return response()->json(['topup' => $topup->toCard(), 'methods' => $this->topups->methods()]);
    }

    public function showTopup(Request $request, WalletTopup $topup): JsonResponse
    {
        abort_unless($topup->user_id === $request->user()->id, 404);

        return response()->json(['topup' => $topup->toCard(), 'methods' => $this->topups->methods(), 'balance' => (int) $request->user()->balance]);
    }

    public function claimTopup(Request $request, WalletTopup $topup): JsonResponse
    {
        abort_unless($topup->user_id === $request->user()->id, 404);
        $data = $request->validate([
            'method' => ['required', 'string', Rule::in(array_keys((array) config('plus.methods')))],
            'note' => ['nullable', 'string', 'max:300'],
        ]);
        $this->topups->claim($topup, $data['method'], $data['note'] ?? null);

        return response()->json(['topup' => $topup->refresh()->toCard(), 'balance' => $request->user()->refresh()->balance]);
    }

    public function cancelTopup(Request $request, WalletTopup $topup): JsonResponse
    {
        abort_unless($topup->user_id === $request->user()->id, 404);
        $this->topups->cancel($topup);

        return response()->json(['topup' => $topup->refresh()->toCard()]);
    }

    /** Покупка з рахунку. Не вистачає коштів — 422 з errors.shortfall (копійки), щоб запропонувати поповнення. */
    public function purchase(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'string', Rule::in(array_keys((array) config('plus.products')))],
            'username' => ['nullable', 'string', 'max:64'],
            'family_id' => ['nullable', 'integer'],
            'server_id' => ['nullable', 'integer'],
            'renew' => ['boolean'],
        ]);
        $user = $request->user();

        try {
            $payment = $this->shop->buy($user, $data['product'], $data, $request->boolean('renew'));
        } catch (InsufficientFunds $e) {
            return response()->json([
                'message' => 'На рахунку не вистачає '.Wallet::uah($e->shortfall).'.',
                'errors' => ['shortfall' => [(string) $e->shortfall]],
            ], 422);
        }

        return response()->json([
            'payment_id' => $payment->id,
            'balance' => (int) $user->balance,
            'message' => Shop::label($data['product']).' — готово!',
        ]);
    }

    /** Увімкнути / вимкнути автопродовження свого GameCon+ або GameCon+ сім’ї, яку очолює людина. */
    public function renewal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'family_id' => ['nullable', 'integer'],
            'product' => ['required', 'string', Rule::in(['plus_month', 'plus_year', 'family_month', 'family_year'])],
            'active' => ['required', 'boolean'],
        ]);
        $user = $request->user();
        $owner = isset($data['family_id'])
            ? PlusController::ledFamilies($user)->firstWhere('id', (int) $data['family_id'])
            : $user;
        abort_if($owner === null, 403, 'Керувати GameCon+ сім’ї може лише її лідер.');
        abort_unless(($owner instanceof Family) === str_starts_with($data['product'], 'family_'), 422);

        $this->shop->setRenewal($user, $data['product'], $owner, (bool) $data['active']);
        if ($data['active']) {
            $this->shop->renewDueFor($user);
        }

        return response()->json(['renewals' => $this->renewals($request), 'balance' => $user->refresh()->balance]);
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
        $rows = PlusRenewal::query()->where('user_id', $user->id)->get();

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
            ];
        })->values()->all();
    }
}
