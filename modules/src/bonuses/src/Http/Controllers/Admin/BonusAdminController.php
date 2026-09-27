<?php

namespace Addons\Bonuses\Http\Controllers\Admin;

use Addons\Bonuses\Models\BankDeposit;
use Addons\Bonuses\Models\BankTransfer;
use Addons\Bonuses\Models\BonusPayout;
use Addons\Bonuses\Models\BonusSettings;
use Addons\Bonuses\Models\CashRequest;
use Addons\Bonuses\Models\InvestmentAchievementTier;
use Addons\Bonuses\Models\ManualBonusAward;
use Addons\Bonuses\Services\BonusCalculator;
use Addons\Bonuses\Support\FinanceNotifier;
use App\Models\User;
use App\Support\CsvExport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BonusAdminController
{
    /** @return array{from:string,to:string,paid:string} */
    private function filtersFrom(Request $request): array
    {
        return [
            'from' => $request->query('from', ''),
            'to' => $request->query('to', ''),
            'paid' => $request->query('paid', ''),
        ];
    }

    private function applyFilters(\Illuminate\Database\Eloquent\Builder $query, array $f): \Illuminate\Database\Eloquent\Builder
    {
        return $query
            ->when($f['from'] !== '', fn ($qq) => $qq->whereDate('week_start', '>=', $f['from']))
            ->when($f['to'] !== '', fn ($qq) => $qq->whereDate('week_start', '<=', $f['to']))
            ->when($f['paid'] === '1', fn ($qq) => $qq->where('paid', true))
            ->when($f['paid'] === '0', fn ($qq) => $qq->where('paid', false));
    }

    public function index(Request $request): Response
    {
        $filters = $this->filtersFrom($request);

        $payouts = $this->applyFilters(BonusPayout::query(), $filters)
            ->with('user:id,name')
            ->orderByDesc('week_start')
            ->orderByDesc('total_amount')
            ->paginate(30)
            ->withQueryString();

        return Inertia::render('Admin/Bonuses/Index', [
            'settings' => BonusSettings::current(),
            'tiers' => InvestmentAchievementTier::query()->orderBy('sort_order')->orderBy('threshold_amount')->get(),
            'payouts' => $payouts,
            'filters' => $filters,
            'manualAwards' => ManualBonusAward::query()
                ->with(['user:id,name', 'awardedBy:id,name'])
                ->latest()
                ->limit(30)
                ->get(),
            // Скасувати можна — reverseTransfer() нижче; сам переказ не
            // видаляється (аудит-слід лишається), лише позначається
            // reversed_at і виключається з розрахунку балансу обох сторін.
            'transfers' => BankTransfer::query()
                ->with(['sender:id,name', 'recipient:id,name', 'reversedBy:id,name'])
                ->latest()
                ->limit(30)
                ->get(),
            'deposits' => BankDeposit::query()
                ->with('user:id,name')
                ->latest()
                ->limit(30)
                ->get(),
            'cashRequests' => CashRequest::query()
                ->with(['user:id,name', 'resolvedBy:id,name'])
                ->latest()
                ->limit(30)
                ->get(),
        ]);
    }

    /** Пошук учасника для форми ручної виплати — той самий контракт, що й Reports::searchMembers. */
    public function searchMembers(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        if (mb_strlen($query) < 2) {
            return response()->json(['ok' => true, 'message' => null, 'data' => ['members' => []], 'errors' => null, 'redirect' => null]);
        }

        $members = User::query()->inActiveFamily()
            ->where('is_shadow', false)
            ->where('name', 'like', '%'.$query.'%')
            ->orderBy('name')
            ->limit(10)
            ->get(['id', 'name']);

        return response()->json([
            'ok' => true,
            'message' => null,
            'data' => ['members' => $members],
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function storeManualAward(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $award = ManualBonusAward::create([
            ...$data,
            'awarded_by' => $request->user()->id,
        ]);
        FinanceNotifier::manualAwardGranted($award, $request->user());

        return back()->with('success', 'Премію видано.');
    }

    public function destroyManualAward(ManualBonusAward $manualAward): RedirectResponse
    {
        $manualAward->delete();
        FinanceNotifier::manualAwardRevoked($manualAward, request()->user());

        return back()->with('success', 'Запис видалено.');
    }

    /** Той самий фільтр, що й на екрані. */
    public function export(Request $request): StreamedResponse
    {
        $filters = $this->filtersFrom($request);

        $payouts = $this->applyFilters(BonusPayout::query(), $filters)
            ->with('user:id,name')
            ->orderByDesc('week_start')
            ->get();

        $rows = $payouts->map(fn (BonusPayout $p) => [
            $p->user?->name ?? '—',
            // week_start — 'date' колонка, але НЕ закастована в моделі
            // (лишається сирим рядком з БД, як і в даних, що йдуть на
            // фронт) — ->format() на ній впав би фатальною помилкою.
            $p->week_start ? \Illuminate\Support\Carbon::parse($p->week_start)->format('d.m.Y') : '',
            $p->bizwar_amount,
            $p->contract_amount,
            $p->streak_bonus_amount,
            $p->contracts_count_bonus_amount,
            $p->investment_bonus_amount,
            $p->total_amount,
            $p->paid ? 'Так' : 'Ні',
            $p->paid_at?->format('d.m.Y H:i'),
        ]);

        return CsvExport::stream('bonuses.csv', [
            'Учасник', 'Тиждень від', 'Бізвар', 'Контракти', 'Бонус за серію',
            "Бонус за к-сть", 'Інвестиційний тір', 'Разом', 'Виплачено', 'Дата виплати',
        ], $rows);
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'bizwar_base_rate' => ['required', 'integer', 'min:0'],
            'contract_light_rate' => ['required', 'integer', 'min:0'],
            'contract_medium_rate' => ['required', 'integer', 'min:0'],
            'contract_heavy_rate' => ['required', 'integer', 'min:0'],
            'streak_threshold' => ['nullable', 'integer', 'min:1'],
            'streak_bonus_amount' => ['required', 'integer', 'min:0'],
            'contracts_count_threshold' => ['nullable', 'integer', 'min:1'],
            'contracts_count_bonus_amount' => ['required', 'integer', 'min:0'],
        ]);

        BonusSettings::current()->update($data);

        return back()->with('success', 'Налаштування премій збережено.');
    }

    public function updateBankSettings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'transfer_enabled' => ['required', 'boolean'],
            'transfer_daily_limit' => ['nullable', 'integer', 'min:1'],
            'transfer_min_amount' => ['required', 'integer', 'min:1'],
            'deposit_enabled' => ['required', 'boolean'],
            'deposit_interest_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'deposit_min_amount' => ['required', 'integer', 'min:1'],
            'deposit_term_days' => ['required', 'integer', 'min:1'],
        ]);

        BonusSettings::current()->update($data);

        return back()->with('success', 'Налаштування банку збережено.');
    }

    /**
     * Скасування переказу: НЕ видалення рядка (аудит-слід лишається
     * назавжди), лише reversed_at/reversed_by — BalanceCalculator сам
     * виключає позначені рядки з обох боків (відправник і отримувач).
     */
    public function reverseTransfer(BankTransfer $transfer): JsonResponse
    {
        if ($transfer->reversed_at !== null) {
            return response()->json([
                'ok' => false,
                'message' => 'Цей переказ уже скасовано.',
                'data' => null,
                'errors' => null,
                'redirect' => null,
            ], 422);
        }

        $transfer->update([
            'reversed_at' => now(),
            'reversed_by' => request()->user()->id,
        ]);

        $admin = request()->user()->name;
        $amount = FinanceNotifier::money($transfer->amount);

        FinanceNotifier::notify(
            $transfer->sender,
            'bank_transfer_reversed',
            '↩️',
            'Переказ скасовано',
            "+{$amount} повернуто на ваш рахунок — переказ до {$transfer->recipient?->name} скасовано.\nСкасував(-ла): {$admin}",
        );
        FinanceNotifier::notify(
            $transfer->recipient,
            'bank_transfer_reversed',
            '↩️',
            'Вхідний переказ скасовано',
            "−{$amount} — переказ від {$transfer->sender?->name} скасовано, кошти повернуто відправнику.\nСкасував(-ла): {$admin}",
        );

        return response()->json([
            'ok' => true,
            'message' => 'Переказ скасовано, кошти повернуто.',
            'data' => null,
            'errors' => null,
            'redirect' => null,
        ]);
    }

    /** Кошти вже "пішли" з балансу при запиті — тут лише підтверджуємо, що готівку фактично передали на руки. */
    public function completeCashRequest(CashRequest $cashRequest): JsonResponse
    {
        if ($cashRequest->status !== 'pending') {
            return response()->json([
                'ok' => false,
                'message' => 'Цей запит уже опрацьовано.',
                'data' => null,
                'errors' => null,
                'redirect' => null,
            ], 422);
        }

        $cashRequest->update([
            'status' => 'completed',
            'resolved_by' => request()->user()->id,
            'resolved_at' => now(),
        ]);

        FinanceNotifier::notify(
            $cashRequest->user,
            'bank_cash_completed',
            '✅',
            'Готівку видано',
            'Запит на '.FinanceNotifier::money($cashRequest->amount)." підтверджено — готівку видано на руки.\nПідтвердив(-ла): ".request()->user()->name,
        );

        return response()->json([
            'ok' => true,
            'message' => 'Позначено виданим.',
            'data' => null,
            'errors' => null,
            'redirect' => null,
        ]);
    }

    /** Скасування: НЕ видалення (аудит-слід лишається), кошти повертаються на баланс учасника. */
    public function cancelCashRequest(CashRequest $cashRequest): JsonResponse
    {
        if ($cashRequest->status !== 'pending') {
            return response()->json([
                'ok' => false,
                'message' => 'Цей запит уже опрацьовано.',
                'data' => null,
                'errors' => null,
                'redirect' => null,
            ], 422);
        }

        $cashRequest->update([
            'status' => 'cancelled',
            'resolved_by' => request()->user()->id,
            'resolved_at' => now(),
        ]);

        FinanceNotifier::notify(
            $cashRequest->user,
            'bank_cash_cancelled',
            '❌',
            'Запит на готівку скасовано',
            '+'.FinanceNotifier::money($cashRequest->amount)." повернуто на ваш рахунок — запит на готівку скасовано.\nСкасував(-ла): ".request()->user()->name,
        );

        return response()->json([
            'ok' => true,
            'message' => 'Запит скасовано, кошти повернуто.',
            'data' => null,
            'errors' => null,
            'redirect' => null,
        ]);
    }

    public function storeTier(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'threshold_amount' => ['required', 'integer', 'min:1'],
            'bonus_amount' => ['required', 'integer', 'min:0'],
        ]);

        InvestmentAchievementTier::create([
            ...$data,
            'sort_order' => (int) InvestmentAchievementTier::max('sort_order') + 1,
        ]);

        return back()->with('success', 'Тір додано.');
    }

    public function destroyTier(InvestmentAchievementTier $tier): RedirectResponse
    {
        $tier->delete();

        return back()->with('success', 'Тір видалено.');
    }

    public function markPaid(BonusPayout $payout): JsonResponse
    {
        $payout->update([
            'paid' => true,
            'paid_at' => now(),
            'paid_by' => request()->user()->id,
        ]);

        return response()->json([
            'ok' => true,
            'message' => 'Позначено виплаченим.',
            'data' => null,
            'errors' => null,
            'redirect' => null,
        ]);
    }

    /**
     * Ручний запуск для тестування чи наздоганяння пропущеного тижня —
     * та сама логіка, що й у щотижневому scheduled-виклику.
     */
    public function runNow(): JsonResponse
    {
        $calculator = app(BonusCalculator::class);
        $calculator->runWeeklyPayouts();

        return response()->json([
            'ok' => true,
            'message' => 'Розрахунок виконано.',
            'data' => null,
            'errors' => null,
            'redirect' => null,
        ]);
    }
}
