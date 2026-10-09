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
            $rows = $this->emptyScores();

            FamilyReport::query()
                ->where('family_id', $family->id)
                ->where('status', FamilyReport::STATUS_APPROVED)
                ->when($since, fn ($q, CarbonImmutable $s) => $q->where('event_date', '>=', $s->toDateString()))
                ->select(['id', 'type', 'beneficiary_id', 'data', 'reward'])
                ->lazyById(1000)
                ->each(function (FamilyReport $report) use (&$rows, $rating) {
                    $id = $report->beneficiary_id;
                    if (! array_key_exists($id, $rows)) {
                        $rows[$id] = $this->blankScore();
                    }
                    $data = $report->data ?? [];
                    $rows[$id]['earned'] += $report->reward;

                    switch ($report->type) {
                        case FamilyReport::TYPE_BIZWAR:
                            $rows[$id]['bizwar_wins'] += (int) ($data['wins'] ?? 0);
                            $rows[$id]['bizwar_losses'] += (int) ($data['losses'] ?? 0);
                            if ($rating['bizwar']) {
                                $rows[$id]['points'] += (int) ($data['wins'] ?? 0) * (int) $rating['points_bizwar_win'] + (int) ($data['losses'] ?? 0) * (int) $rating['points_bizwar_loss'];
                            }
                            break;
                        case FamilyReport::TYPE_CONTRACT:
                            $rows[$id]['contracts'] += (int) ($data['count'] ?? 0);
                            if ($rating['contracts']) {
                                $rows[$id]['points'] += (int) ($data['count'] ?? 0) * (int) ($rating['points_contract_'.($data['tier'] ?? 'light')] ?? 0);
                            }
                            break;
                        case FamilyReport::TYPE_INVESTMENT:
                            $rows[$id]['invested'] += (int) ($data['amount'] ?? 0);
                            if ($rating['investments']) {
                                $rows[$id]['points'] += intdiv((int) ($data['amount'] ?? 0), 100_000) * (int) $rating['points_per_1000'];
                            }
                            break;
                    }
                });

            FamilyEventAttendance::query()
                ->join('family_events', 'family_events.id', '=', 'family_event_attendance.event_id')
                ->where('family_events.family_id', $family->id)
                ->where('family_events.status', FamilyEvent::STATUS_DONE)
                ->where('family_event_attendance.status', FamilyEventAttendance::STATUS_ATTENDED)
                ->when($since, fn ($q, CarbonImmutable $s) => $q->where('family_events.starts_at', '>=', $s->utc()))
                ->get(['family_event_attendance.member_id', 'family_events.points', 'family_events.reward'])
                ->each(function (FamilyEventAttendance $a) use (&$rows, $rating) {
                    $id = $a->member_id;
                    if (! array_key_exists($id, $rows)) {
                        $rows[$id] = $this->blankScore();
                    }
                    $rows[$id]['events']++;
                    $reward = $a->getAttribute('reward');
                    $points = $a->getAttribute('points');
                    $rows[$id]['earned'] += is_numeric($reward) ? (int) $reward : 0;
                    if ($rating['events']) {
                        $pointValue = is_numeric($points) ? (int) $points : 0;
                        $rows[$id]['points'] += $pointValue > 0 ? $pointValue : (int) $rating['points_event'];
                    }
                });

            $members = FamilyMember::query()->with('user')
                ->where('family_id', $family->id)
                ->where('status', FamilyMember::STATUS_ACTIVE)
                ->get();

            $ranked = $members
                ->map(fn (FamilyMember $m) => [...$m->toCard($family), ...(array_key_exists($m->id, $rows) ? $rows[$m->id] : $this->blankScore())])
                ->sortByDesc(fn (array $r) => [$r['points'], $r['earned']])
                ->values()
                ->map(fn (array $r, int $i) => [...$r, 'place' => $i + 1])
                ->all();

            return array_values($ranked);
        });
    }

    /**
     * @return array{points: int, bizwar_wins: int, bizwar_losses: int, contracts: int, invested: int, events: int, earned: int}
     */
    private function blankScore(): array
    {
        return ['points' => 0, 'bizwar_wins' => 0, 'bizwar_losses' => 0, 'contracts' => 0, 'invested' => 0, 'events' => 0, 'earned' => 0];
    }

    /**
     * @return array<int, array{points: int, bizwar_wins: int, bizwar_losses: int, contracts: int, invested: int, events: int, earned: int}>
     */
    private function emptyScores(): array
    {
        return [];
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
