<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyCashout;
use App\Models\FamilyDeposit;
use App\Models\FamilyMember;
use App\Models\FamilyTransaction;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Банк сім’ї: особисті рахунки учасників, казна й незмінна книга операцій.
 */
class FamilyBank
{
    public function __construct(
        private readonly FamilyAudit $audit,
        private readonly FamilyNotifier $notifier,
    ) {}

    /**
     * Проводить операцію атомарно, блокуючи рахунок учасника й казну.
     *
     * @param  int  $amount  зміна балансу учасника (копійки, зі знаком)
     * @param  int  $treasuryDelta  зміна казни (копійки, зі знаком)
     */
    public function post(
        Family $family,
        ?FamilyMember $member,
        string $type,
        int $amount,
        int $treasuryDelta = 0,
        ?FamilyMember $actor = null,
        ?string $comment = null,
        ?Model $subject = null,
        bool $allowNegative = false,
    ): FamilyTransaction {
        return DB::transaction(function () use ($family, $member, $type, $amount, $treasuryDelta, $actor, $comment, $subject, $allowNegative) {
            $balanceAfter = null;
            if ($member) {
                $locked = FamilyMember::query()->whereKey($member->id)->lockForUpdate()->firstOrFail();
                $balanceAfter = $locked->balance + $amount;
                if ($amount < 0 && $balanceAfter < 0 && ! $allowNegative) {
                    throw ValidationException::withMessages(['amount' => 'Недостатньо коштів на рахунку: доступно '.Money::format($locked->balance).'.']);
                }
                FamilyMember::query()->whereKey($member->id)->update(['balance' => $balanceAfter]);
                $member->balance = $balanceAfter;
            }

            $treasuryAfter = null;
            if ($treasuryDelta !== 0) {
                $lockedFamily = Family::query()->whereKey($family->id)->lockForUpdate()->firstOrFail();
                $treasuryAfter = $lockedFamily->treasury + $treasuryDelta;
                Family::query()->whereKey($family->id)->update(['treasury' => $treasuryAfter]);
                $family->treasury = $treasuryAfter;
            }

            $transaction = FamilyTransaction::query()->create([
                'family_id' => $family->id,
                'member_id' => $member?->id,
                'type' => $type,
                'amount' => $amount,
                'balance_after' => $balanceAfter,
                'treasury_delta' => $treasuryDelta,
                'treasury_after' => $treasuryAfter,
                'actor_id' => $actor?->id,
                'comment' => $comment,
                'subject_type' => $subject?->getMorphClass(),
                'subject_id' => $subject?->getKey(),
                'created_at' => now(),
            ]);

            $this->notifier->refresh($family, 'bank');

            return $transaction;
        });
    }

    public function manual(Family $family, FamilyMember $actor, FamilyMember $target, int $amount, string $comment): FamilyTransaction
    {
        $transaction = $this->post($family, $target, $amount >= 0 ? 'manual_credit' : 'manual_debit', $amount, 0, $actor, $comment);
        $this->audit->log($family, 'MANUAL_BALANCE_EDIT', $actor, $target, [
            'amount' => $amount,
            'balance_after' => $transaction->balance_after,
            'comment' => $comment,
        ]);
        $this->notifier->members($target, $family, 'bank', ($amount >= 0 ? 'Нараховано ' : 'Списано ').Money::format(abs($amount)).": {$comment}", $this->url($family));

        return $transaction;
    }

    public function treasury(Family $family, FamilyMember $actor, int $amount, string $comment): FamilyTransaction
    {
        $transaction = $this->post($family, null, $amount >= 0 ? 'treasury_in' : 'treasury_out', 0, $amount, $actor, $comment);
        $this->audit->log($family, 'TREASURY_EDIT', $actor, null, [
            'amount' => $amount,
            'treasury_after' => $transaction->treasury_after,
            'comment' => $comment,
        ]);

        return $transaction;
    }

    public function requestCashout(Family $family, FamilyMember $member, int $amount, ?string $note): FamilyCashout
    {
        $min = Money::toMinor($family->setting('cashout.min_amount', 0));
        if ($amount < max(1, $min)) {
            throw ValidationException::withMessages(['amount' => 'Мінімальна сума виведення — '.Money::format(max(100, $min)).'.']);
        }

        $cashout = DB::transaction(function () use ($family, $member, $amount, $note) {
            $cashout = FamilyCashout::query()->create([
                'family_id' => $family->id,
                'member_id' => $member->id,
                'amount' => $amount,
                'note' => $note,
            ]);
            $this->post($family, $member, 'cashout_hold', -$amount, 0, $member, 'Заявка на виведення #'.$cashout->id, $cashout);

            return $cashout;
        });

        $this->notifier->holders($family, 'treasury.manage', 'cashout', "{$member->displayName()} просить вивести ".Money::format($amount), $this->url($family, 'queue'), $member);

        return $cashout;
    }

    public function payCashout(Family $family, FamilyCashout $cashout, FamilyMember $officer, ?UploadedFile $proof, ?string $comment): void
    {
        DB::transaction(function () use ($family, $cashout, $officer, $proof, $comment) {
            $locked = FamilyCashout::query()->with('member.user')->whereKey($cashout->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== FamilyCashout::STATUS_PENDING) {
                throw ValidationException::withMessages(['cashout' => 'Заявку вже оброблено.']);
            }

            $locked->update([
                'status' => FamilyCashout::STATUS_PAID,
                'processed_by' => $officer->id,
                'processed_at' => now(),
                'proof_path' => $proof?->store('family-cashouts/'.$family->id, 'local'),
                'process_comment' => $comment,
            ]);

            $member = $locked->member;
            $this->post($family, $member, 'cashout_paid', 0, -$locked->amount, $officer, 'Виплата в грі '.$member->displayName(), $locked);
            $this->audit->log($family, 'MONEY_CASHOUT', $officer, $member, [
                'cashout_id' => $locked->id,
                'amount' => $locked->amount,
                'comment' => $comment,
                'proof' => $proof !== null,
            ]);
            $this->notifier->members($member, $family, 'cashout', 'Виплату '.Money::format($locked->amount).' видано в грі ✅', $this->url($family, 'bank'));
        });
    }

    public function cancelCashout(Family $family, FamilyCashout $cashout, FamilyMember $actor, ?string $reason): void
    {
        DB::transaction(function () use ($family, $cashout, $actor, $reason) {
            $locked = FamilyCashout::query()->with('member.user')->whereKey($cashout->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== FamilyCashout::STATUS_PENDING) {
                throw ValidationException::withMessages(['cashout' => 'Заявку вже оброблено.']);
            }

            $locked->update([
                'status' => FamilyCashout::STATUS_CANCELLED,
                'processed_by' => $actor->id,
                'processed_at' => now(),
                'process_comment' => $reason,
            ]);
            $member = $locked->member;
            $this->post($family, $member, 'cashout_refund', $locked->amount, 0, $actor, 'Повернення заявки #'.$locked->id, $locked);

            if ($actor->id !== $member->id) {
                $this->audit->log($family, 'CASHOUT_CANCEL', $actor, $member, ['cashout_id' => $locked->id, 'amount' => $locked->amount, 'reason' => $reason]);
                $this->notifier->members($member, $family, 'cashout', 'Заявку на '.Money::format($locked->amount).' скасовано'.($reason ? ": {$reason}" : ''), $this->url($family, 'bank'));
            }
        });
    }

    public function openDeposit(Family $family, FamilyMember $member, int $amount, string $period, int $periods): FamilyDeposit
    {
        $settings = $family->resolvedSettings()['deposits'];
        if (! $settings['enabled']) {
            throw ValidationException::withMessages(['amount' => 'Депозити в сім’ї вимкнено.']);
        }
        if ($amount < Money::toMinor($settings['min_amount'])) {
            throw ValidationException::withMessages(['amount' => 'Мінімальний депозит — '.Money::format(Money::toMinor($settings['min_amount'])).'.']);
        }
        $max = $period === 'daily' ? (int) $settings['max_days'] : (int) $settings['max_weeks'];
        if ($periods < 1 || $periods > $max) {
            throw ValidationException::withMessages(['periods' => "Строк — від 1 до {$max}."]);
        }

        $rateBp = (int) round((float) ($period === 'daily' ? $settings['daily_rate'] : $settings['weekly_rate']) * 100);
        $payout = $amount + intdiv($amount * $rateBp * $periods, 10000);

        return DB::transaction(function () use ($family, $member, $amount, $period, $periods, $rateBp, $payout) {
            $deposit = FamilyDeposit::query()->create([
                'family_id' => $family->id,
                'member_id' => $member->id,
                'amount' => $amount,
                'period' => $period,
                'periods' => $periods,
                'rate_bp' => $rateBp,
                'payout' => $payout,
                'matures_at' => $period === 'daily' ? now()->addDays($periods) : now()->addWeeks($periods),
            ]);
            $this->post($family, $member, 'deposit_open', -$amount, 0, $member, 'Депозит #'.$deposit->id, $deposit);

            return $deposit;
        });
    }

    /**
     * Дострокове закриття: повертається лише тіло депозиту.
     */
    public function closeDeposit(Family $family, FamilyDeposit $deposit, FamilyMember $member): void
    {
        DB::transaction(function () use ($family, $deposit, $member) {
            $locked = FamilyDeposit::query()->whereKey($deposit->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== FamilyDeposit::STATUS_ACTIVE) {
                throw ValidationException::withMessages(['deposit' => 'Депозит уже закрито.']);
            }
            $locked->update(['status' => FamilyDeposit::STATUS_CLOSED, 'closed_at' => now(), 'paid' => $locked->amount]);
            $this->post($family, $member, 'deposit_close', $locked->amount, 0, $member, 'Дострокове закриття депозиту #'.$locked->id, $locked);
        });
    }

    /**
     * Виплачує депозити, строк яких настав.
     */
    public function matureDue(): int
    {
        $count = 0;
        FamilyDeposit::query()
            ->where('status', FamilyDeposit::STATUS_ACTIVE)
            ->where('matures_at', '<=', now())
            ->with(['family', 'member.user'])
            ->chunkById(100, function ($deposits) use (&$count) {
                foreach ($deposits as $deposit) {
                    DB::transaction(function () use ($deposit, &$count) {
                        $locked = FamilyDeposit::query()->whereKey($deposit->id)->lockForUpdate()->first();
                        if (! $locked || $locked->status !== FamilyDeposit::STATUS_ACTIVE) {
                            return;
                        }
                        $locked->update(['status' => FamilyDeposit::STATUS_MATURED, 'closed_at' => now(), 'paid' => $locked->payout]);
                        $this->post($deposit->family, $deposit->member, 'deposit_payout', $locked->amount, 0, null, 'Повернення депозиту #'.$locked->id, $locked);
                        if ($locked->payout > $locked->amount) {
                            $this->post($deposit->family, $deposit->member, 'deposit_interest', $locked->payout - $locked->amount, 0, null, 'Відсотки за депозитом #'.$locked->id, $locked);
                        }
                        $this->notifier->members($deposit->member, $deposit->family, 'bank', 'Депозит виплачено: '.Money::format($locked->payout), $this->url($deposit->family, 'bank'));
                        $count++;
                    });
                }
            });

        return $count;
    }

    private function url(Family $family, string $section = 'bank'): string
    {
        return route('families.'.$section, $family, absolute: false);
    }
}
