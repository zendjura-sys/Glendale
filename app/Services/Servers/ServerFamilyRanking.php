<?php

namespace App\Services\Servers;

use App\Models\Family;
use App\Models\GtaServer;
use App\Services\Families\FamilyRating;
use Illuminate\Support\Facades\Cache;

/**
 * Публічний рейтинг сімей сервера: сума балів учасників за період (тиждень, місяць, увесь час),
 * перемоги в бізварах, контракти й події. Місце порівнюється з учорашнім знімком — стрілка ↑↓.
 */
class ServerFamilyRanking
{
    public const PERIODS = ['week' => 'Тиждень', 'month' => 'Місяць', 'all' => 'Увесь час'];

    public function __construct(private readonly FamilyRating $rating) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function rows(GtaServer $server, string $period): array
    {
        $period = array_key_exists($period, self::PERIODS) ? $period : 'month';

        $rows = Cache::remember("server.families.{$server->id}.{$period}", now()->addMinutes(10), function () use ($server, $period) {
            return Family::query()->with('server')->where('server_id', $server->id)->where('status', Family::STATUS_VERIFIED)->get()
                ->map(function (Family $family) use ($period) {
                    $board = collect($this->rating->leaderboard($family, $period));

                    return [
                        ...$family->toCard(),
                        'points' => (int) $board->sum('points'),
                        'bizwar_wins' => (int) $board->sum('bizwar_wins'),
                        'contracts' => (int) $board->sum('contracts'),
                        'events' => (int) $board->sum('events'),
                        'active' => $board->filter(fn (array $r) => (int) $r['points'] > 0)->count(),
                    ];
                })
                ->sortBy([['points', 'desc'], ['members_count', 'desc']])
                ->values()
                ->map(fn (array $row, int $i) => [...$row, 'place' => $i + 1])
                ->all();
        });

        // Знімок місць на сьогодні; зміна — відносно вчорашнього.
        $today = now()->toDateString();
        $places = array_column($rows, 'place', 'id');
        Cache::add("server.families.snap.{$server->id}.{$period}.{$today}", $places, now()->addDays(3));
        $yesterday = (array) Cache::get("server.families.snap.{$server->id}.{$period}.".now()->subDay()->toDateString(), []);

        return array_map(fn (array $row) => [
            ...$row,
            'change' => isset($yesterday[$row['id']]) ? (int) $yesterday[$row['id']] - (int) $row['place'] : null,
        ], $rows);
    }
}
