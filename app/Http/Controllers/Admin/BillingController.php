<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlusDonation;
use App\Models\PlusPayment;
use App\Models\PlusRenewal;
use App\Models\User;
use App\Models\WalletTopup;
use App\Models\WalletTransaction;
use App\Services\Billing\Donatello;
use App\Services\Billing\InsufficientFunds;
use App\Services\Billing\Shop;
use App\Services\Billing\TopUps;
use App\Services\Billing\Wallet;
use App\Support\Settings\SiteSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Адмінка білінгу: заявки на поповнення, донати без коду, корекція балансу, повернення,
 * способи поповнення й товари в продажу.
 */
class BillingController extends Controller
{
    public function __construct(
        private readonly TopUps $topups,
        private readonly Shop $shop,
        private readonly Wallet $wallet,
        private readonly SiteSettings $settings,
    ) {}

    public function index(Request $request, Donatello $donatello): Response
    {
        $this->admin($request);
        $pending = WalletTopup::query()->with('user')->where('status', WalletTopup::PENDING)
            ->orderByRaw('claimed_at is null')->orderByDesc('claimed_at')->latest('id')->limit(100)->get()
            ->filter->open()->values();

        return Inertia::render('admin/billing', [
            'stats' => [
                'balance' => (int) User::query()->sum('balance'),
                'topups_month' => (int) WalletTopup::query()->where('status', WalletTopup::PAID)->where('paid_at', '>=', now()->startOfMonth())->sum('credited'),
                'claimed' => $pending->whereNotNull('claimed_at')->count(),
                'renewals' => PlusRenewal::query()->where('active', true)->count(),
            ],
            'pending' => $pending->map(fn (WalletTopup $t) => [
                ...$t->toCard(),
                'note' => $t->note,
                'claimed_at' => $t->claimed_at?->toIso8601String(),
                'user' => $t->user->only(['id', 'name', 'username']),
            ]),
            'recent' => WalletTopup::query()->with(['user', 'confirmer'])->where('status', WalletTopup::PAID)->latest('paid_at')->limit(20)->get()
                ->map(fn (WalletTopup $t) => [
                    ...$t->toCard(),
                    'paid_at' => $t->paid_at?->toIso8601String(),
                    'by' => $t->confirmer->name ?? ($t->donation_id ? 'API' : null),
                    'user' => $t->user->only(['id', 'name', 'username']),
                ]),
            'donations' => PlusDonation::query()->whereNull('topup_id')->latest('id')->limit(30)->get()
                ->map(fn (PlusDonation $d) => [
                    'id' => $d->id,
                    'provider' => $d->provider,
                    'name' => $d->name,
                    'message' => $d->message,
                    'amount' => $d->amount,
                    'currency' => $d->currency,
                    'code' => TopUps::codeIn($d->message),
                    'donated_at' => ($d->donated_at ?? $d->created_at)->toIso8601String(),
                ]),
            'payments' => PlusPayment::query()->with('user')->latest('id')->limit(30)->get()->map(fn (PlusPayment $p) => [
                'id' => $p->id,
                'product' => $p->product,
                'amount' => $p->amount,
                'status' => $p->status,
                'provider' => $p->provider,
                'user' => $p->user?->only(['id', 'name', 'username']),
                'created_at' => $p->created_at->toIso8601String(),
            ]),
            'transactions' => WalletTransaction::query()->with(['user', 'by'])->whereIn('type', ['adjust', 'refund'])->latest('id')->limit(20)->get()
                ->map(fn (WalletTransaction $t) => [
                    ...$t->toCard(),
                    'user' => $t->user->only(['id', 'name', 'username']),
                    'by' => $t->by?->name,
                ]),
            'methods' => array_values($this->topups->allMethods()),
            'products' => collect(Shop::catalog())->map(fn (array $p, string $key) => ['key' => $key, ...$p])->values(),
            'donatello' => ['configured' => $donatello->configured()],
        ]);
    }

    /** Зарахувати заявку. amount — скільки фактично прийшло, ₴ (порожньо — сума заявки). */
    public function confirm(Request $request, WalletTopup $topup): RedirectResponse
    {
        $this->admin($request);
        $data = $request->validate(['amount' => ['nullable', 'numeric', 'min:0.01', 'max:1000000']]);
        $credited = isset($data['amount']) ? (int) round((float) $data['amount'] * 100) : null;
        $ok = $this->topups->confirm($topup, $request->user(), $credited);

        Inertia::flash('toast', $ok
            ? ['type' => 'success', 'message' => 'Зараховано '.Wallet::uah((int) $topup->refresh()->credited).' на рахунок '.$topup->user->name.'.']
            : ['type' => 'error', 'message' => 'Заявку вже зараховано.']);

        return back();
    }

    public function cancel(Request $request, WalletTopup $topup): RedirectResponse
    {
        $this->admin($request);
        $this->topups->cancel($topup);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку '.$topup->code.' скасовано.']);

        return back();
    }

    /** Донат без коду (або з помилкою в коді) → заявка за кодом. */
    public function attach(Request $request, PlusDonation $donation): RedirectResponse
    {
        $this->admin($request);
        $data = $request->validate(['code' => ['required', 'string', 'max:20']]);
        abort_if($donation->topup_id !== null, 422, 'Донат уже зараховано.');
        $code = TopUps::codeIn($data['code']);
        $topup = $code ? WalletTopup::query()->where('code', $code)->where('status', WalletTopup::PENDING)->first() : null;
        abort_if($topup === null, 422, 'Відкритої заявки з таким кодом немає.');
        $credited = strtoupper($donation->currency) === 'UAH' ? $donation->amount * 100 : null;
        $this->topups->confirm($topup, $request->user(), $credited, $donation);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Донат зараховано за заявкою '.$topup->code.'.']);

        return back();
    }

    public function sync(Request $request, Donatello $donatello): RedirectResponse
    {
        $this->admin($request);
        abort_unless($donatello->configured(), 422, 'Спершу додайте токен Donatello (Інтеграції → Donatello).');
        $matched = $this->topups->syncDonatello();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Donatello перевірено: зараховано '.$matched.'.']);

        return back();
    }

    /** Ручна корекція балансу: + зарахувати, − списати (не нижче нуля). Причина обов’язкова. */
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
            abort(422, 'На рахунку менше, ніж ви хочете списати.');
        }
        if ((float) $data['amount'] > 0) {
            $this->shop->renewDueFor($user);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Баланс '.$user->name.': '.Wallet::uah($user->balance).'.']);

        return back();
    }

    /** Повернути покупку на рахунок: доступ і просування знімаються. */
    public function refund(Request $request, PlusPayment $payment): RedirectResponse
    {
        $this->admin($request);
        $this->shop->refund($payment, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Покупку повернуто на рахунок.']);

        return back();
    }

    public function methods(Request $request): RedirectResponse
    {
        $this->admin($request);
        $keys = array_keys((array) config('plus.methods'));
        $data = $request->validate([
            'methods' => ['required', 'array'],
            'methods.*.key' => ['required', 'string', Rule::in($keys)],
            'methods.*.enabled' => ['boolean'],
            'methods.*.url' => ['nullable', 'string', 'max:300', 'url:https'],
            'methods.*.label' => ['nullable', 'string', 'max:40'],
            'methods.*.note' => ['nullable', 'string', 'max:300'],
        ], ['methods.*.url.url' => 'Посилання має починатися з https://']);

        $saved = [];
        foreach ($data['methods'] as $row) {
            $saved[$row['key']] = [
                'enabled' => (bool) ($row['enabled'] ?? false),
                'url' => filled($row['url'] ?? null) ? trim((string) $row['url']) : null,
                'label' => filled($row['label'] ?? null) ? trim((string) $row['label']) : null,
                'note' => filled($row['note'] ?? null) ? trim((string) $row['note']) : null,
            ];
        }
        $this->settings->put(['plus_methods' => $saved]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Способи поповнення збережено.']);

        return back();
    }

    /** Які товари в продажу. Зняті зникають зі сторінок цін і GameCon+, їх автопродовження зупиняється. */
    public function products(Request $request): RedirectResponse
    {
        $this->admin($request);
        $keys = array_keys((array) config('plus.products'));
        $data = $request->validate([
            'enabled' => ['present', 'array'],
            'enabled.*' => ['string', Rule::in($keys)],
        ]);
        $this->settings->put(['plus_disabled' => array_values(array_diff($keys, $data['enabled']))]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Товари оновлено.']);

        return back();
    }

    private function admin(Request $request): void
    {
        abort_unless($request->user()->isAdmin(), 403);
    }
}
