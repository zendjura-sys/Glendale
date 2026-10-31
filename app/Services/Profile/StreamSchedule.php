<?php

namespace App\Services\Profile;

use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Розклад стрімів людини: до 7 щотижневих слотів (день, час за Києвом, назва).
 * На сторінці — «Наступний стрім» і весь тиждень. Зберігається в налаштуваннях людини.
 */
class StreamSchedule
{
    public const TZ = 'Europe/Kyiv';

    public const MAX = 7;

    /**
     * @return list<array{day: int, time: string, title: string|null, next_at: string}>
     */
    public function of(User $user): array
    {
        $raw = is_array($raw = $user->pref('stream_schedule')) ? $raw : [];
        $slots = [];
        foreach ($raw as $slot) {
            if (! is_array($slot) || ! is_int($slot['day'] ?? null) || ! is_string($slot['time'] ?? null)) {
                continue;
            }
            $slots[] = [
                'day' => $slot['day'],
                'time' => $slot['time'],
                'title' => is_string($slot['title'] ?? null) ? $slot['title'] : null,
                'next_at' => $this->next($slot['day'], $slot['time'])->toIso8601String(),
            ];
        }
        usort($slots, fn (array $a, array $b) => $a['next_at'] <=> $b['next_at']);

        return $slots;
    }

    /**
     * @param  list<array{day: int|string, time: string, title?: string|null}>  $slots
     */
    public function save(User $user, array $slots): void
    {
        $clean = [];
        foreach (array_slice($slots, 0, self::MAX) as $slot) {
            $title = trim((string) ($slot['title'] ?? ''));
            $clean[] = ['day' => (int) $slot['day'], 'time' => $slot['time'], 'title' => $title !== '' ? mb_substr($title, 0, 60) : null];
        }
        $user->mergePref(['stream_schedule' => $clean]);
    }

    /** Найближчий момент слота (день тижня ISO 1–7, час «ГГ:ХХ» за Києвом) — у UTC. */
    public function next(int $day, string $time, ?CarbonInterface $now = null): CarbonInterface
    {
        $now = CarbonImmutable::instance($now ?? now())->setTimezone(self::TZ);
        [$h, $m] = array_map('intval', explode(':', $time) + [1 => '0']);
        $at = $now->startOfDay()->addDays(($day - $now->dayOfWeekIso + 7) % 7)->setTime($h, $m);
        if ($at->lessThanOrEqualTo($now)) {
            $at = $at->addWeek();
        }

        return $at->utc();
    }
}
