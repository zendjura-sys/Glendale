<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyReport;

/**
 * Тижневі завдання сім’ї: лідер задає до трьох цілей на тиждень (звіти, бали рейтингу, проведені події),
 * а прогрес рахується з того, що сім’я вже робить на сайті — окремо нічого відмічати не треба.
 * Нагорода — текст від лідера («премія 50 000 ₴ кожному»): виплачує він сам через казну.
 */
class WeeklyGoals
{
    public const MAX = 3;

    public const TYPES = [
        'reports' => 'Схвалених звітів',
        'points' => 'Балів у рейтингу',
        'events' => 'Проведених подій',
    ];

    public function __construct(private readonly FamilyRating $rating) {}

    /**
     * Цілі з прогресом за поточний тиждень.
     *
     * @return list<array{id: string, type: string, label: string, target: int, reward: string|null, progress: int, done: bool}>
     */
    public function progress(Family $family): array
    {
        $goals = $this->goals($family);
        if ($goals === []) {
            return [];
        }
        ['start' => $start] = WeeklyDigest::week();
        $values = [];
        foreach (array_unique(array_column($goals, 'type')) as $type) {
            $values[$type] = match ($type) {
                'reports' => FamilyReport::query()->where('family_id', $family->id)->where('status', FamilyReport::STATUS_APPROVED)
                    ->where('reviewed_at', '>=', $start->utc())->count(),
                'points' => array_sum(array_map(fn (array $r) => (int) $r['points'], $this->rating->leaderboard($family, 'week'))),
                'events' => FamilyEvent::query()->where('family_id', $family->id)->where('status', FamilyEvent::STATUS_DONE)
                    ->where('starts_at', '>=', $start->utc())->count(),
                default => 0,
            };
        }

        return array_map(fn (array $g) => [
            ...$g,
            'label' => self::TYPES[$g['type']],
            'progress' => min($values[$g['type']] ?? 0, $g['target']),
            'done' => ($values[$g['type']] ?? 0) >= $g['target'],
        ], $goals);
    }

    /** @return list<array{id: string, type: string, target: int, reward: string|null}> */
    public function goals(Family $family): array
    {
        $raw = $family->settings['weekly_goals'] ?? [];

        return array_values(array_filter(array_map(fn ($g) => is_array($g) && isset(self::TYPES[$g['type'] ?? '']) ? [
            'id' => (string) ($g['id'] ?? ''),
            'type' => (string) $g['type'],
            'target' => max(1, (int) ($g['target'] ?? 1)),
            'reward' => isset($g['reward']) && $g['reward'] !== '' ? (string) $g['reward'] : null,
        ] : null, is_array($raw) ? $raw : [])));
    }

    /** @param  list<array{id?: string|null, type: string, target: int, reward?: string|null}>  $goals */
    public function save(Family $family, array $goals): void
    {
        $settings = $family->settings ?? [];
        $settings['weekly_goals'] = array_values(array_map(fn (array $g) => [
            'id' => ($g['id'] ?? '') !== '' ? (string) $g['id'] : substr(md5(uniqid('', true)), 0, 8),
            'type' => $g['type'],
            'target' => max(1, (int) $g['target']),
            'reward' => isset($g['reward']) && trim((string) $g['reward']) !== '' ? trim((string) $g['reward']) : null,
        ], array_slice($goals, 0, self::MAX)));
        $family->forceFill(['settings' => $settings])->save();
    }
}
