<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PaymentCard;
use App\Models\PaymentOrder;
use App\Models\PlusPayment;
use App\Models\PlusRenewal;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Services\Billing\Catalog;
use App\Services\Billing\Checkout;
use App\Services\Billing\GooglePay;
use App\Services\Billing\InsufficientFunds;
use App\Services\Billing\Shop;
use App\Services\Billing\Wallet;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Адмінка білінгу: оплати карткою (monobank), повернення на картку, тарифи й правила підписок, Google Pay,
 * залишки старого балансу.
 */
class BillingController extends Controller
{
    public function __construct(
        private readonly Checkout $checkout,
        private readonly Catalog $catalog,
        private readonly Shop $shop,
        private readonly Wallet $wallet,
        private readonly SiteSettings $settings,
    ) {}

    public function index(Request $request, GooglePay $googlePay): Response
    {
        $this->admin($request);
        $month = now()->startOfMonth();

        return Inertia::render('admin/billing', [
            'stats' => [
                'paid_month' => (int) PaymentOrder::query()->where('status', PaymentOrder::PAID)->where('paid_at', '>=', $month)->sum('amount'),
                'orders_month' => PaymentOrder::query()->where('status', PaymentOrder::PAID)->where('paid_at', '>=', $month)->count(),
                'renewals' => PlusRenewal::query()->where('active', true)->count(),
                'renewals_card' => PlusRenewal::query()->where('active', true)->whereNotNull('card_id')->count(),
                'cards' => PaymentCard::query()->count(),
                'legacy_balance' => (int) User::query()->where('balance', '>', 0)->sum('balance'),
            ],
            'monobank' => $this->checkout->available(),
            'orders' => PaymentOrder::query()->with('user')->where('status', '!=', PaymentOrder::CANCELLED)->latest('id')->limit(60)->get()
                ->map(fn (PaymentOrder $o) => [...$o->toCard(), 'user' => $o->user->only(['id', 'name', 'username'])]),
            'payments' => PlusPayment::query()->with('user')->where('provider', 'wallet')->latest('id')->limit(20)->get()->map(fn (PlusPayment $p) => [
                'id' => $p->id,
                'product' => $p->product,
                'amount' => $p->amount,
                'status' => $p->status,
                'provider' => $p->provider,
                'user' => $p->user?->only(['id', 'name', 'username']),
                'created_at' => $p->created_at->toIso8601String(),
            ]),
            'balances' => User::query()->where('balance', '>', 0)->orderByDesc('balance')->limit(50)->get(['id', 'name', 'username', 'balance']),
            'transactions' => WalletTransaction::query()->with(['user', 'by'])->whereIn('type', ['adjust', 'refund'])->latest('id')->limit(20)->get()
                ->map(fn (WalletTransaction $t) => [...$t->toCard(), 'user' => $t->user->only(['id', 'name', 'username']), 'by' => $t->by?->name]),
            'products' => array_values($this->catalog->products()),
            'rules' => $this->catalog->rules(),
            'google_pay' => [...$googlePay->settings(), 'ready' => $googlePay->enabled()],
            'webhook' => route('billing.monobank.webhook'),
        ]);
    }

    /** Повернути оплату на картку: товар знімається, гроші — на картку платника (через monobank). */
    public function refundOrder(Request $request, PaymentOrder $order): RedirectResponse
    {
        $this->admin($request);
        $this->checkout->refund($order, $request->user());
        Log::info('billing: refund order', ['order' => $order->id, 'by' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Кошти за '.$order->code.' повернуто на картку, доступ знято.']);

        return back();
    }

    /** Повернути стару покупку з балансу (до переходу на оплату карткою) — гроші назад на баланс. */
    public function refund(Request $request, PlusPayment $payment): RedirectResponse
    {
        $this->admin($request);
        abort_unless($payment->provider === 'wallet', 422, 'Оплати карткою повертаються через замовлення.');
        $this->shop->refund($payment, $request->user());
        Log::info('billing: refund wallet payment', ['payment' => $payment->id, 'by' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Покупку повернуто на баланс.']);

        return back();
    }

    /** Корекція залишку старого балансу (наприклад, обнулити після повернення коштів людині). */
    public function adjust(Request $request): RedirectResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'username' => ['required', 'string', 'max:64'],
            'amount' => ['required', 'numeric', 'not_in:0', 'min:-1000000', 'max:1000000'],
            'reason' => ['required', 'string', 'max:160'],
        ]);
        $user = User::query()->where('username', ltrim($data['username'], '@'))->first();
        abort_if($user === null, 422, 'Людину з таким ніком не знайдено.');

        try {
            $this->wallet->adjust($user, (int) round((float) $data['amount'] * 100), 'Корекція: '.$data['reason'], $request->user());
        } catch (InsufficientFunds) {
            abort(422, 'На балансі менше, ніж ви хочете списати.');
        }
        Log::info('billing: adjust balance', ['user' => $user->id, 'by' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Залишок '.$user->name.': '.Wallet::uah((int) $user->refresh()->balance).'.']);

        return back();
    }

    /**
     * Тарифи: ціна, строк, назва, «стара» ціна, позначка, порядок, автопродовження, продаж; нові тарифи; видалення власних.
     */
    public function products(Request $request): RedirectResponse
    {
        $this->admin($request);
        $base = array_keys((array) config('plus.products'));
        $data = $request->validate([
            'products' => ['present', 'array', 'max:60'],
            'products.*.key' => ['required', 'string', 'regex:/^[a-z][a-z0-9_]{2,39}$/', 'distinct'],
            'products.*.kind' => ['required', Rule::in(Catalog::KINDS)],
            'products.*.promo' => ['nullable', Rule::in(Catalog::PROMOS)],
            'products.*.name' => ['required', 'string', 'max:80'],
            'products.*.price' => ['required', 'integer', 'min:1', 'max:1000000'],
            'products.*.old_price' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'products.*.days' => ['required', 'integer', 'min:1', 'max:3660'],
            'products.*.recurring' => ['boolean'],
            'products.*.enabled' => ['boolean'],
            'products.*.badge' => ['nullable', 'string', 'max:24'],
        ], [
            'products.*.key.regex' => 'Ключ тарифу — латинські малі літери, цифри й _, від 3 символів (наприклад, plus_quarter).',
        ]);

        $saved = [];
        foreach (array_values($data['products']) as $position => $row) {
            $key = $row['key'];
            $entry = [
                'name' => trim($row['name']),
                'price' => (int) $row['price'],
                'old_price' => isset($row['old_price']) && (int) $row['old_price'] > (int) $row['price'] ? (int) $row['old_price'] : null,
                'days' => (int) $row['days'],
                'recurring' => (bool) ($row['recurring'] ?? true),
                'enabled' => (bool) ($row['enabled'] ?? true),
                'badge' => filled($row['badge'] ?? null) ? trim((string) $row['badge']) : null,
                'position' => $position,
            ];
            if (! in_array($key, $base, true)) {
                // Власний тариф: тип (і вид просування) задаються при створенні.
                $entry['kind'] = $row['kind'];
                $entry['promo'] = $row['kind'] === 'promo' ? ($row['promo'] ?? 'top') : null;
            }
            $saved[$key] = $entry;
        }
        // Базовий тариф не можна видалити — лише зняти з продажу.
        foreach ($base as $key) {
            $saved[$key] ??= ['enabled' => false, 'position' => count($saved)];
        }
        $this->settings->put(['billing_products' => $saved, 'plus_disabled' => []]);
        Log::info('billing: products saved', ['by' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Тарифи збережено.']);

        return back();
    }

    /** Правила підписок: коли продовжувати, повтори невдалої оплати, збережені картки, час на оплату. */
    public function rules(Request $request): RedirectResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'renew_before_hours' => ['required', 'integer', 'min:1', 'max:168'],
            'retry_hours' => ['required', 'integer', 'min:1', 'max:168'],
            'retry_max' => ['required', 'integer', 'min:1', 'max:10'],
            'order_hours' => ['required', 'integer', 'min:1', 'max:72'],
            'card_renewals' => ['boolean'],
            'offer_save_card' => ['boolean'],
            'badges' => ['array'],
            'badges.*' => ['string', Rule::in(Catalog::BADGES)],
        ]);
        $data['badges'] = array_values($data['badges'] ?? []);
        $this->settings->put(['billing_rules' => $data]);
        Log::info('billing: rules saved', ['by' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Правила підписок збережено.']);

        return back();
    }

    /** Google Pay: середовище, Merchant ID з Google Pay & Wallet Console, шлюз і gatewayMerchantId від monobank. */
    public function googlePay(Request $request): RedirectResponse
    {
        $this->admin($request);
        $data = $request->validate([
            'enabled' => ['boolean'],
            'environment' => ['required', Rule::in(['TEST', 'PRODUCTION'])],
            'merchant_id' => ['nullable', 'string', 'regex:/^[A-Za-z0-9]{12,18}$/'],
            'merchant_name' => ['required', 'string', 'max:60'],
            'gateway' => ['required', 'string', 'regex:/^[a-z0-9_]{2,40}$/'],
            'gateway_merchant_id' => ['nullable', 'string', 'max:120'],
        ], ['merchant_id.regex' => 'Merchant ID Google Pay — 12–18 латинських літер і цифр (Google Pay & Wallet Console).']);
        abort_if(($data['enabled'] ?? false) && $data['environment'] === 'PRODUCTION' && blank($data['merchant_id'] ?? null), 422, 'Для бойового середовища потрібен Merchant ID з Google Pay & Wallet Console.');
        $this->settings->put(['google_pay' => $data]);
        Log::info('billing: google pay saved', ['by' => $request->user()->id]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування Google Pay збережено.']);

        return back();
    }

    private function admin(Request $request): void
    {
        abort_unless($request->user()->isAdmin(), 403);
    }
}
