<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Models\FamilyMember;
use App\Models\FamilyReport;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * Модульний рейтинг: що дає бали, вирішують перемикачі в налаштуваннях сім’ї.
 */
class FamilyRating
{
    public const PERIODS = ['week' => 'Тиждень', 'month' => 'Місяць', 'all' => 'За весь час'];

    public static function since(string $period): ?CarbonImmutable
    {
        $now = CarbonImmutable::now(ReportService::TIMEZONE);

        return match ($period) {
            'week' => $now->startOfWeek(),
            'month' => $now->startOfMonth(),
            default => null,
        };
    }

    /**
     * @return list<array<string, mixed>> відсортовано за балами
     */
    public function leaderboard(Family $family, string $period = 'week'): array
    {
        $since = self::since($period);
        $version = Cache::get('family.rating.v.'.$family->id, 0);

        return Cache::remember("family.rating.{$family->id}.{$period}.{$version}", now()->addMinutes(5), function () use ($family, $since) {
            $rating = $family->resolvedSettings()['rating'];
            $rows = [];
            $row = fn () => ['points' => 0, 'bizwar_wins' => 0, 'bizwar_losses' => 0, 'contracts' => 0, 'invested' => 0, 'events' => 0, 'earned' => 0];

            FamilyReport::query()
                ->where('family_id', $family->id)
                ->where('status', FamilyReport::STATUS_APPROVED)
                ->when($since, fn ($q, CarbonImmutable $s) => $q->where('event_date', '>=', $s->toDateString()))
                ->select(['id', 'type', 'beneficiary_id', 'data', 'reward'])
                ->lazyById(1000)
                ->each(function (FamilyReport $report) use (&$rows, $rating, $row) {
                    $r = &$rows[$report->beneficiary_id];
                    $r ??= $row();
                    $data = $report->data ?? [];
                    $r['earned'] += $report->reward;

                    switch ($report->type) {
                        case FamilyReport::TYPE_BIZWAR:
                            $r['bizwar_wins'] += (int) ($data['wins'] ?? 0);
                            $r['bizwar_losses'] += (int) ($data['losses'] ?? 0);
                            if ($rating['bizwar']) {
                                $r['points'] += (int) ($data['wins'] ?? 0) * (int) $rating['points_bizwar_win'] + (int) ($data['losses'] ?? 0) * (int) $rating['points_bizwar_loss'];
                            }
                            break;
                        case FamilyReport::TYPE_CONTRACT:
                            $r['contracts'] += (int) ($data['count'] ?? 0);
                            if ($rating['contracts']) {
                                $r['points'] += (int) ($data['count'] ?? 0) * (int) ($rating['points_contract_'.($data['tier'] ?? 'light')] ?? 0);
                            }
                            break;
                        case FamilyReport::TYPE_INVESTMENT:
                            $r['invested'] += (int) ($data['amount'] ?? 0);
                            if ($rating['investments']) {
                                $r['points'] += intdiv((int) ($data['amount'] ?? 0), 100_000) * (int) $rating['points_per_1000'];
                            }
                            break;
                    }
                    unset($r);
                });

            FamilyEventAttendance::query()
                ->join('family_events', 'family_events.id', '=', 'family_event_attendance.event_id')
                ->where('family_events.family_id', $family->id)
                ->where('family_events.status', FamilyEvent::STATUS_DONE)
                ->where('family_event_attendance.status', FamilyEventAttendance::STATUS_ATTENDED)
                ->when($since, fn ($q, CarbonImmutable $s) => $q->where('family_events.starts_at', '>=', $s->utc()))
                ->get(['family_event_attendance.member_id', 'family_events.points', 'family_events.reward'])
                ->each(function ($a) use (&$rows, $rating, $row) {
                    $r = &$rows[$a->member_id];
                    $r ??= $row();
                    $r['events']++;
                    $r['earned'] += (int) $a->reward;
                    if ($rating['events']) {
                        $r['points'] += (int) $a->points > 0 ? (int) $a->points : (int) $rating['points_event'];
                    }
                    unset($r);
                });

            $members = FamilyMember::query()->with('user')
                ->where('family_id', $family->id)
                ->where('status', FamilyMember::STATUS_ACTIVE)
                ->get();

            return $members
                ->map(fn (FamilyMember $m) => [...$m->toCard($family), ...($rows[$m->id] ?? $row())])
                ->sortByDesc(fn (array $r) => [$r['points'], $r['earned']])
                ->values()
                ->map(fn (array $r, int $i) => [...$r, 'place' => $i + 1])
                ->all();
        });
    }

    /**
     * Сумарні бали сім’ї за місяць — для рейтингу сімей сервера.
     */
    public function familyScore(Family $family): int
    {
        return (int) collect($this->leaderboard($family, 'month'))->sum('points');
    }

    public function flush(Family $family): void
    {
        Cache::forever('family.rating.v.'.$family->id, (int) Cache::get('family.rating.v.'.$family->id, 0) + 1);
    }
}
