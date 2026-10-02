<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyPunishment;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class Discipline
{
    public function __construct(
        private readonly FamilyBank $bank,
        private readonly FamilyAudit $audit,
        private readonly FamilyNotifier $notifier,
        private readonly FamilyService $families,
    ) {}

    public function issue(Family $family, FamilyMember $issuer, FamilyMember $target, string $type, string $reason, ?int $amount = null): FamilyPunishment
    {
        if (! $issuer->outranks($target, $family)) {
            throw ValidationException::withMessages(['member_id' => 'Карати можна лише учасників із нижчим рангом.']);
        }
        if ($type === FamilyPunishment::TYPE_FINE && ($amount === null || $amount < 100)) {
            throw ValidationException::withMessages(['amount' => 'Вкажіть суму штрафу (від 1 ₴).']);
        }

        $punishment = DB::transaction(function () use ($family, $issuer, $target, $type, $reason, $amount) {
            $punishment = FamilyPunishment::query()->create([
                'family_id' => $family->id,
                'member_id' => $target->id,
                'issuer_id' => $issuer->id,
                'type' => $type,
                'reason' => $reason,
                'amount' => $type === FamilyPunishment::TYPE_FINE ? $amount : null,
                'expires_at' => $type === FamilyPunishment::TYPE_WARN ? now()->addDays((int) $family->setting('discipline.warn_days', 30)) : null,
            ]);

            if ($type === FamilyPunishment::TYPE_FINE) {
                $this->bank->post($family, $target, 'fine', -(int) $amount, 0, $issuer, "Штраф: {$reason}", $punishment, allowNegative: true);
            }

            $this->audit->log($family, 'SANCTION_ISSUE', $issuer, $target, [
                'punishment_id' => $punishment->id,
                'type' => $type,
                'reason' => $reason,
                'amount' => $punishment->amount,
            ]);

            if ($type === FamilyPunishment::TYPE_KICK) {
                $this->families->kick($family, $issuer, $target, $reason, logged: true);
            }

            return $punishment;
        });

        $label = FamilyPunishment::TYPES[$type].($type === FamilyPunishment::TYPE_FINE ? ' '.Money::format((int) $amount) : '');
        $this->notifier->members($target, $family, 'sanction', "{$label}: {$reason}", route('families.discipline', $family, absolute: false));

        if ($type === FamilyPunishment::TYPE_WARN) {
            $this->escalate($family, $target->fresh() ?? $target, $issuer);
        }
        $this->notifier->refresh($family, 'discipline');

        return $punishment;
    }

    /**
     * N активних попереджень → автоматичне пониження або виключення.
     */
    public function escalate(Family $family, FamilyMember $target, ?FamilyMember $issuer = null): ?string
    {
        $limit = max(1, (int) $family->setting('discipline.warn_limit', 3));
        $warns = FamilyPunishment::query()->active()
            ->where('member_id', $target->id)
            ->where('type', FamilyPunishment::TYPE_WARN)
            ->get();

        if ($warns->count() < $limit || ! $target->isActive()) {
            return null;
        }

        $mode = $family->setting('discipline.escalation', 'demote');
        if ($mode === 'demote' && $target->rank <= 1) {
            $mode = 'kick';
        }

        DB::transaction(function () use ($family, $target, $issuer, $warns, $limit, $mode) {
            FamilyPunishment::query()->whereKey($warns->pluck('id'))->update([
                'revoked_at' => now(),
                'revoke_reason' => 'Погашено автоескалацією',
            ]);

            $reason = "{$limit} активних попередження";
            FamilyPunishment::query()->create([
                'family_id' => $family->id,
                'member_id' => $target->id,
                'issuer_id' => null,
                'type' => $mode === 'kick' ? FamilyPunishment::TYPE_KICK : FamilyPunishment::TYPE_REPRIMAND,
                'reason' => $mode === 'kick' ? "Автовиключення: {$reason}" : "Автопониження в ранзі: {$reason}",
                'is_auto' => true,
            ]);

            $this->audit->log($family, 'SANCTION_ESCALATE', $issuer, $target, [
                'mode' => $mode,
                'warns' => $warns->count(),
                'rank_before' => $target->rank,
            ]);

            if ($mode === 'kick') {
                $this->families->kick($family, null, $target, "Автовиключення: {$reason}", logged: true);
            } else {
                $target->forceFill(['rank' => $target->rank - 1])->save();
                $this->notifier->members($target, $family, 'sanction', "Автопониження до рангу «{$family->rankTitle($target->rank)}»: {$reason}", route('families.discipline', $family, absolute: false));
            }
        });

        return $mode;
    }

    public function revoke(Family $family, FamilyPunishment $punishment, FamilyMember $actor, string $reason): void
    {
        if (! $punishment->isActive() || $punishment->type === FamilyPunishment::TYPE_KICK) {
            throw ValidationException::withMessages(['punishment' => 'Це покарання не можна зняти.']);
        }

        DB::transaction(function () use ($family, $punishment, $actor, $reason) {
            $punishment->update(['revoked_at' => now(), 'revoked_by' => $actor->id, 'revoke_reason' => $reason]);
            $member = $punishment->loadMissing('member')->member;

            if ($punishment->type === FamilyPunishment::TYPE_FINE && $punishment->amount) {
                $this->bank->post($family, $member, 'fine_refund', $punishment->amount, 0, $actor, "Скасування штрафу: {$reason}", $punishment);
            }

            $this->audit->log($family, 'SANCTION_REVOKE', $actor, $member, [
                'punishment_id' => $punishment->id,
                'type' => $punishment->type,
                'reason' => $reason,
            ]);
        });

        $this->notifier->refresh($family, 'discipline');
    }
}
