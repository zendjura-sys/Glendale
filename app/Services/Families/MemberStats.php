<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyMember;
use App\Models\FamilyPunishment;
use App\Models\FamilyReport;

/**
 * Особиста статистика учасника сім’ї: той самий розрахунок для огляду сім’ї на сайті
 * й для віджета застосунку — другої логіки немає.
 */
class MemberStats
{
    public function __construct(
        private readonly WeeklyDigest $digest,
        private readonly FamilyRating $rating,
        private readonly FamilyGate $gate,
    ) {}

    /**
     * Плитки огляду сім’ї (суми — у копійках).
     *
     * @return array{week_earned: int, week_total: int, pending_reports: int, warns: int, warn_limit: int}
     */
    public function overview(Family $family, FamilyMember $member): array
    {
        $week = $this->digest->build($family);

        return [
            'week_earned' => (int) (collect($week['lines'])->firstWhere('member.id', $member->id)['total'] ?? 0),
            'week_total' => (int) $week['total'],
            'pending_reports' => FamilyReport::query()->where('beneficiary_id', $member->id)->where('status', FamilyReport::STATUS_PENDING)->count(),
            'warns' => FamilyPunishment::query()->active()->where('member_id', $member->id)->where('type', FamilyPunishment::TYPE_WARN)->count(),
            'warn_limit' => (int) $family->setting('discipline.warn_limit', 3),
        ];
    }

    /**
     * Усе для віджета на головному екрані: гроші, ранг, місце в рейтингу, бізвари, найближча подія.
     *
     * @return array<string, mixed>
     */
    public function widget(Family $family, FamilyMember $member): array
    {
        $board = $this->rating->leaderboard($family, 'week');
        $place = null;
        $score = null;
        foreach ($board as $index => $row) {
            if ((int) ($row['id'] ?? 0) === $member->id) {
                $place = $index + 1;
                $score = $row;
                break;
            }
        }
        $event = FamilyEvent::query()->where('family_id', $family->id)
            ->where('status', FamilyEvent::STATUS_PLANNED)
            ->where('starts_at', '>=', now())
            ->orderBy('starts_at')
            ->first();

        return [
            'family' => $family->toCard(),
            'member' => [
                'display' => $member->displayName(),
                'rank' => $member->rank,
                'rank_title' => $family->rankTitle($member->rank),
            ],
            'balance' => $member->balance,
            'treasury' => $this->gate->can($member, $family, 'treasury.manage') ? $family->treasury : null,
            ...$this->overview($family, $member),
            'rating' => [
                'place' => $place,
                'of' => count($board),
                'points' => (int) ($score['points'] ?? 0),
                'bizwar_wins' => (int) ($score['bizwar_wins'] ?? 0),
                'bizwar_losses' => (int) ($score['bizwar_losses'] ?? 0),
                'contracts' => (int) ($score['contracts'] ?? 0),
                'events' => (int) ($score['events'] ?? 0),
            ],
            'next_event' => $event ? ['title' => $event->title, 'type_label' => FamilyEvent::TYPES[$event->type] ?? $event->type, 'starts_at' => $event->starts_at->toIso8601String()] : null,
            'updated_at' => now()->toIso8601String(),
        ];
    }
}
