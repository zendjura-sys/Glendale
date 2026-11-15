<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyReport;
use App\Models\FamilyShift;

/**
 * Завдання змін: «виконати N контрактів складності X», «перемогти в N бізварах», «взяти участь у N бізварах».
 * Зараховуються автоматично: учасник подає звіт, офіцер схвалює — прогрес зміни росте сам.
 * Рахуються лише схвалені звіти учасника зміни, подані під час зміни (і до доби після кінця).
 */
class ShiftGoals
{
    public const TYPES = [
        'contract' => 'Контракти',
        'bizwar_win' => 'Перемоги в бізварах',
        'bizwar_any' => 'Участь у бізварах',
    ];

    /** Скільки часу після кінця зміни ще можна здати звіт за неї. */
    public const GRACE_HOURS = 24;

    public function __construct(
        private readonly FamilyAudit $audit,
        private readonly FamilyNotifier $notifier,
    ) {}

    /**
     * Нормалізувати ціль із форми; null — зміна без завдання.
     *
     * @return array{type: string, tier: string|null, count: int}|null
     */
    public static function normalize(?string $type, ?string $tier, ?int $count): ?array
    {
        if ($type === null || ! isset(self::TYPES[$type]) || ($count ?? 0) < 1) {
            return null;
        }

        return [
            'type' => $type,
            'tier' => $type === 'contract' && isset(FamilyReport::TIERS[$tier ?? '']) ? $tier : null,
            'count' => min(1000, (int) $count),
        ];
    }

    /** Підпис цілі: «5 контрактів (Важкий)», «3 перемоги в бізварах». */
    public static function label(array $goal): string
    {
        $count = (int) ($goal['count'] ?? 0);

        return match ($goal['type'] ?? null) {
            'contract' => $count.' × '.'Контракти'.(isset($goal['tier']) && $goal['tier'] ? ' ('.FamilyReport::TIERS[$goal['tier']].')' : ''),
            'bizwar_win' => $count.' × '.'Перемоги в бізварах',
            'bizwar_any' => $count.' × '.'Участь у бізварах',
            default => '',
        };
    }

    /** Порахувати прогрес зміни зі схвалених звітів. */
    public function progress(FamilyShift $shift): int
    {
        $goal = (array) $shift->goal;
        if ($shift->member_id === null || $goal === []) {
            return 0;
        }
        $type = $goal['type'] === 'contract' ? FamilyReport::TYPE_CONTRACT : FamilyReport::TYPE_BIZWAR;
        $reports = FamilyReport::query()
            ->where('family_id', $shift->family_id)
            ->where('beneficiary_id', $shift->member_id)
            ->where('type', $type)
            ->where('status', FamilyReport::STATUS_APPROVED)
            ->whereBetween('created_at', [$shift->starts_at, $shift->ends_at->copy()->addHours(self::GRACE_HOURS)])
            ->get(['data']);

        return (int) $reports->sum(function (FamilyReport $r) use ($goal) {
            $data = (array) $r->data;

            return match ($goal['type']) {
                'contract' => ($goal['tier'] ?? null) === null || ($data['tier'] ?? null) === $goal['tier'] ? (int) ($data['count'] ?? 0) : 0,
                'bizwar_win' => (int) ($data['wins'] ?? 0),
                'bizwar_any' => (int) ($data['wins'] ?? 0) + (int) ($data['losses'] ?? 0),
                default => 0,
            };
        });
    }

    /** Перерахувати відкриті зміни учасника після схваленого звіту. */
    public function recheck(Family $family, FamilyMember $member): void
    {
        $shifts = FamilyShift::query()
            ->where('family_id', $family->id)
            ->where('member_id', $member->id)
            ->whereNotNull('goal')
            ->whereNull('completed_at')
            ->where('starts_at', '<=', now())
            ->where('ends_at', '>=', now()->subHours(self::GRACE_HOURS))
            ->get();
        foreach ($shifts as $shift) {
            $progress = $this->progress($shift);
            $count = (int) ($shift->goal['count'] ?? 0);
            $shift->forceFill([
                'progress' => $progress,
                'completed_at' => $progress >= $count && $count > 0 ? now() : null,
            ])->save();
            if ($shift->completed_at !== null) {
                $label = self::label((array) $shift->goal);
                $this->audit->log($family, 'SHIFT_DONE', null, $member, ['shift_id' => $shift->id, 'title' => $shift->title, 'goal' => $label]);
                $url = route('families.shifts', $family, absolute: false);
                $this->notifier->members($member, $family, 'shift', "Завдання зміни «{$shift->title}» виконано: {$label}", $url);
                $this->notifier->holders($family, 'events.manage', 'shift', "{$member->displayName()} виконав(-ла) завдання зміни «{$shift->title}»: {$label}", $url, $member);
            }
        }
    }
}
