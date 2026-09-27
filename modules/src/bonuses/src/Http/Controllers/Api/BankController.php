<?php

namespace Addons\Bonuses\Http\Controllers\Api;

use Addons\Bonuses\Models\BankDeposit;
use Addons\Bonuses\Models\BankTransfer;
use Addons\Bonuses\Models\BonusPayout;
use Addons\Bonuses\Models\BonusSettings;
use Addons\Bonuses\Models\CashRequest;
use Addons\Bonuses\Models\ManualBonusAward;
use Addons\Bonuses\Services\BalanceCalculator;
use Addons\Bonuses\Services\DepositService;
use Addons\Bonuses\Support\FinanceNotifier;
use Addons\Notifications\Services\NotificationService;
use App\Models\User;
use App\Support\MemberCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Мобільний двійник Http\Controllers\BonusController — та сама бізнес-
 * логіка (ліміти, валідація, сповіщення), просто JSON замість Inertia.
 * Навмисно окремий контролер, а не спільний сервіс: той самий підхід, що
 * й у AuthController/BonusAdminController по всьому проєкту — веб- і
 * API-шар кожен свій, без передчасної абстракції заради DRY.
 */
class BankController
{
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        DepositService::settleMaturedFor($userId);

        $payouts = BonusPayout::query()->where('user_id', $userId)->where('paid', true)->get();
        $manualAwards = ManualBonusAward::query()->where('user_id', $userId)->get();

        $transfers = BankTransfer::query()
            ->where('from_user_id', $userId)->orWhere('to_user_id', $userId)
            ->with(['sender:id,name', 'recipient:id,name'])
            ->get();

        $deposits = BankDeposit::query()
            ->where('user_id', $userId)
            ->latest()
            ->get()
            ->map(fn (BankDeposit $d) => [
                'id' => $d->id,
                'amount' => $d->amount,
                'interest_rate' => $d->interest_rate,
                'status' => $d->status,
                'matures_at' => $d->matures_at,
                'payout_amount' => $d->payout_amount,
                'projected_payout' => $d->projectedPayout(),
                'created_at' => $d->created_at,
                'closed_at' => $d->closed_at,
            ]);

        $cashRequests = CashRequest::query()
            ->where('user_id', $userId)
            ->latest()
            ->get()
            ->map(fn (CashRequest $r) => [
                'id' => $r->id,
                'amount' => $r->amount,
                'status' => $r->status,
                'created_at' => $r->created_at,
                'resolved_at' => $r->resolved_at,
            ]);

        $transactions = collect();

        foreach ($payouts as $p) {
            $transactions->push([
                'kind' => 'payout',
                'sign' => '+',
                'amount' => $p->total_amount,
                'label' => 'Тижнева премія',
                'detail' => 'Тиждень від '.\Illuminate\Support\Carbon::parse($p->week_start)->format('d.m.Y')
                    .(($p->discipline_deduction_amount ?? 0) > 0
                        ? ' · утримано '.number_format($p->discipline_deduction_amount, 0, ',', ' ').'₴ (активна догана)' : ''),
                'at' => $p->paid_at ?? $p->created_at,
            ]);
        }

        foreach ($manualAwards as $a) {
            $transactions->push([
                'kind' => 'manual_award',
                'sign' => '+',
                'amount' => $a->amount,
                'label' => 'Ручна премія',
                'detail' => $a->note,
                'at' => $a->created_at,
            ]);
        }

        foreach ($transfers as $t) {
            $out = $t->from_user_id === $userId;
            $transactions->push([
                'kind' => 'transfer',
                'sign' => $t->reversed_at ? '·' : ($out ? '−' : '+'),
                'amount' => $t->amount,
                'label' => $out ? 'Переказ до '.($t->recipient?->name ?? '—') : 'Переказ від '.($t->sender?->name ?? '—'),
                'detail' => $t->note,
                'reversed' => (bool) $t->reversed_at,
                'at' => $t->created_at,
            ]);
        }

        foreach ($deposits as $d) {
            $transactions->push([
                'kind' => 'deposit_open',
                'sign' => '−',
                'amount' => $d['amount'],
                'label' => 'Відкрито депозит',
                'detail' => "на {$d['interest_rate']}% / {$d['created_at']}",
                'at' => $d['created_at'],
            ]);
            if ($d['status'] !== 'active') {
                $transactions->push([
                    'kind' => 'deposit_close',
                    'sign' => '+',
                    'amount' => $d['payout_amount'],
                    'label' => $d['status'] === 'completed' ? 'Депозит дозрів' : 'Дострокове зняття депозиту',
                    'detail' => null,
                    'at' => $d['closed_at'],
                ]);
            }
        }

        foreach ($cashRequests as $r) {
            $transactions->push([
                'kind' => 'cash_request',
                'sign' => $r['status'] === 'cancelled' ? '·' : '−',
                'amount' => $r['amount'],
                'label' => 'Запит на видачу готівки',
                'detail' => match ($r['status']) {
                    'pending' => 'очікує підтвердження керівництва',
                    'completed' => 'видано на руки',
                    default => null,
                },
                'reversed' => $r['status'] === 'cancelled',
                'at' => $r['resolved_at'] ?? $r['created_at'],
            ]);
        }

        $transactions = $transactions->concat(\Addons\Bonuses\Support\DisciplineFines::statementEntries($userId));

        $transactions = $transactions->sortByDesc('at')->values()->take(60);

        return response()->json([
            'card' => [
                'number' => MemberCard::masked($request->user()),
                'numberFull' => MemberCard::number($request->user()),
                'name' => $request->user()->name,
                'balance' => BalanceCalculator::balanceFor($userId),
            ],
            'transactions' => $transactions,
            'deposits' => $deposits,
            'cashRequests' => $cashRequests,
            'depositSettings' => [
                'enabled' => (bool) BonusSettings::current()->deposit_enabled,
                'rate' => (float) BonusSettings::current()->deposit_interest_rate,
                'minAmount' => (int) BonusSettings::current()->deposit_min_amount,
                'termDays' => (int) BonusSettings::current()->deposit_term_days,
            ],
            'transferSettings' => [
                'enabled' => (bool) BonusSettings::current()->transfer_enabled,
                'minAmount' => (int) BonusSettings::current()->transfer_min_amount,
                'dailyLimit' => BonusSettings::current()->transfer_daily_limit,
            ],
        ]);
    }

    public function searchRecipients(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        if (mb_strlen($query) < 2) {
            return response()->json(['members' => []]);
        }

        $members = User::query()->inActiveFamily()
            ->where('id', '!=', $request->user()->id)
            ->where('is_shadow', false)
            ->where('name', 'like', '%'.$query.'%')
            ->orderBy('name')
            ->limit(10)
            ->get(['id', 'name']);

        return response()->json(['members' => $members]);
    }

    public function storeTransfer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'recipient_id' => ['required', 'integer', 'exists:users,id'],
            'amount' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $sender = $request->user();

        if ((int) $data['recipient_id'] === $sender->id) {
            throw ValidationException::withMessages(['recipient_id' => 'Не можна переказати самому собі.']);
        }

        DepositService::settleMaturedFor($sender->id);

        $settings = BonusSettings::current();

        if (! $settings->transfer_enabled) {
            throw ValidationException::withMessages(['amount' => 'Перекази тимчасово вимкнено.']);
        }

        if ($data['amount'] < $settings->transfer_min_amount) {
            throw ValidationException::withMessages(['amount' => "Мінімальна сума переказу — {$settings->transfer_min_amount}₴."]);
        }

        if ($settings->transfer_daily_limit !== null) {
            $sentToday = (int) BankTransfer::query()
                ->where('from_user_id', $sender->id)
                ->whereNull('reversed_at')
                ->where('created_at', '>=', now()->subDay())
                ->sum('amount');

            if ($sentToday + $data['amount'] > $settings->transfer_daily_limit) {
                $left = max(0, $settings->transfer_daily_limit - $sentToday);
                throw ValidationException::withMessages(['amount' => "Денний ліміт переказів — {$settings->transfer_daily_limit}₴. Лишилось: {$left}₴."]);
            }
        }

        DB::transaction(function () use ($data, $sender) {
            $balance = BalanceCalculator::balanceFor($sender->id);

            if ($data['amount'] > $balance) {
                throw ValidationException::withMessages(['amount' => 'Недостатньо коштів на балансі.']);
            }

            BankTransfer::create([
                'from_user_id' => $sender->id,
                'to_user_id' => $data['recipient_id'],
                'amount' => $data['amount'],
                'note' => $data['note'] ?? null,
            ]);
        });

        $recipient = User::find($data['recipient_id']);
        $note = $data['note'] ? "\nКоментар: «{$data['note']}»" : '';

        FinanceNotifier::notify(
            $recipient,
            'bank_transfer_received',
            '💸',
            'Вхідний переказ',
            '+'.FinanceNotifier::money($data['amount'])." від {$sender->name}.".$note,
        );
        FinanceNotifier::receipt(
            $sender,
            '📤',
            'Переказ виконано',
            '−'.FinanceNotifier::money($data['amount'])." → {$recipient?->name}.".$note,
        );

        return response()->json(['message' => 'Переказ виконано.']);
    }

    public function storeDeposit(Request $request): JsonResponse
    {
        $data = $request->validate(['amount' => ['required', 'integer', 'min:1']]);

        $user = $request->user();
        DepositService::settleMaturedFor($user->id);
        DepositService::open($user, $data['amount']);

        return response()->json(['message' => 'Депозит відкрито.']);
    }

    public function withdrawDeposit(Request $request, BankDeposit $deposit): JsonResponse
    {
        if ($deposit->user_id !== $request->user()->id) {
            abort(403);
        }

        DepositService::withdrawEarly($deposit);

        return response()->json(['message' => 'Депозит знято достроково.']);
    }

    public function storeCashRequest(Request $request): JsonResponse
    {
        $data = $request->validate(['amount' => ['required', 'integer', 'min:1']]);

        $user = $request->user();
        DepositService::settleMaturedFor($user->id);

        DB::transaction(function () use ($data, $user) {
            $balance = BalanceCalculator::balanceFor($user->id);

            if ($data['amount'] > $balance) {
                throw ValidationException::withMessages(['amount' => 'Недостатньо коштів на балансі.']);
            }

            CashRequest::create([
                'user_id' => $user->id,
                'amount' => $data['amount'],
                'status' => 'pending',
            ]);
        });

        if (class_exists(NotificationService::class)) {
            $leadership = User::permission('bonuses.manage')->get();
            foreach ($leadership as $lead) {
                app(NotificationService::class)->notify(
                    $lead,
                    'bank_cash_requested',
                    'Запит на видачу готівки',
                    "{$user->name} запросив(-ла) видачу {$data['amount']}₴ готівкою на руки — узгодьте передачу й підтвердіть у адмінці Банку.",
                );
            }
        }

        FinanceNotifier::receipt(
            $user,
            '🏧',
            'Запит на готівку',
            FinanceNotifier::money($data['amount']).' зарезервовано до видачі. Керівництво отримало запит — щойно гроші передадуть на руки, тут з\'явиться підтвердження.',
        );

        return response()->json(['message' => 'Запит надіслано. Замовам і лідеру прийшло сповіщення.']);
    }
}
