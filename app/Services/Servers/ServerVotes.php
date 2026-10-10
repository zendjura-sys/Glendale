<?php

namespace App\Services\Servers;

use App\Models\GtaServer;
use App\Models\ServerVote;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Щоденне голосування за сервери: один голос на людину на день.
 * Топ дня й місяця — за кількістю голосів; власник бачить голоси по днях.
 */
class ServerVotes
{
    /** Скільки досвіду дає один голос (рахується в Achievements). */
    public const XP = 2;

    public function today(): string
    {
        return Carbon::today()->toDateString();
    }

    public function vote(User $user, GtaServer $server): void
    {
        abort_unless($server->status === GtaServer::STATUS_PUBLISHED, 404);
        abort_if($this->votedToday($user) !== null, 422, 'Сьогодні ви вже голосували. Новий голос — завтра.');

        try {
            ServerVote::query()->create([
                'user_id' => $user->id,
                'gta_server_id' => $server->id,
                'voted_on' => $this->today(),
            ]);
        } catch (UniqueConstraintViolationException) {
            abort(422, 'Сьогодні ви вже голосували. Новий голос — завтра.');
        }

        Cache::forget("achievements.{$user->id}");
        Cache::forget('server-votes.month.'.Carbon::today()->format('Y-m'));
    }

    /** За який сервер людина голосувала сьогодні. */
    public function votedToday(User $user): ?int
    {
        $id = ServerVote::query()->where('user_id', $user->id)->where('voted_on', $this->today())->value('gta_server_id');

        return $id === null ? null : (int) $id;
    }

    /**
     * Голоси за поточний місяць по серверах (кеш на хвилину — каталог відкривають часто).
     *
     * @return array<int, int>
     */
    public function monthCounts(): array
    {
        $month = Carbon::today()->startOfMonth();

        /** @var array<int, int> */
        return Cache::remember('server-votes.month.'.$month->format('Y-m'), 60, fn () => ServerVote::query()
            ->where('voted_on', '>=', $month->toDateString())
            ->selectRaw('gta_server_id, count(*) as total')
            ->groupBy('gta_server_id')
            ->pluck('total', 'gta_server_id')
            ->map(fn ($total) => (int) $total)
            ->all());
    }

    /**
     * Топ серверів за день або місяць.
     *
     * @param  'day'|'month'  $period
     * @return list<array{id: int, slug: string, name: string, icon: string|null, platform_label: string, votes: int}>
     */
    public function top(string $period, int $limit = 5): array
    {
        $from = $period === 'day' ? $this->today() : Carbon::today()->startOfMonth()->toDateString();
        $counts = ServerVote::query()
            ->where('voted_on', '>=', $from)
            ->whereHas('server', fn ($query) => $query->published())
            ->selectRaw('gta_server_id, count(*) as total')
            ->groupBy('gta_server_id')
            ->orderByDesc('total')
            ->orderBy('gta_server_id')
            ->limit($limit)
            ->pluck('total', 'gta_server_id');
        $servers = GtaServer::query()->whereIn('id', $counts->keys())->get()->keyBy('id');

        $rows = [];
        foreach ($counts as $id => $total) {
            $server = $servers->get($id);
            if ($server instanceof GtaServer) {
                $rows[] = [
                    'id' => $server->id,
                    'slug' => $server->slug,
                    'name' => $server->name,
                    'icon' => $server->icon,
                    'platform_label' => GtaServer::PLATFORMS[$server->platform] ?? $server->platform,
                    'votes' => (int) $total,
                ];
            }
        }

        return $rows;
    }

    /**
     * Голоси одного сервера; власник і модератори бачать ще й розклад по днях.
     *
     * @return array{today: int, month: int, total: int, rank: int|null, voted_today: int|null, voted_here: bool, daily: list<array{date: string, votes: int}>|null}
     */
    public function forServer(GtaServer $server, User $viewer): array
    {
        $month = $this->monthCounts();
        $mine = $month[$server->id] ?? 0;
        $rank = $mine > 0 ? 1 + count(array_filter($month, fn (int $votes) => $votes > $mine)) : null;
        $voted = $this->votedToday($viewer);

        return [
            'today' => ServerVote::query()->where('gta_server_id', $server->id)->where('voted_on', $this->today())->count(),
            'month' => $mine,
            'total' => ServerVote::query()->where('gta_server_id', $server->id)->count(),
            'rank' => $rank,
            'voted_today' => $voted,
            'voted_here' => $voted === $server->id,
            'daily' => $server->owner_id === $viewer->id || $viewer->isStaff() ? $this->daily($server) : null,
        ];
    }

    /**
     * Голоси за останні 30 днів, по днях (порожні дні — нулі).
     *
     * @return list<array{date: string, votes: int}>
     */
    public function daily(GtaServer $server, int $days = 30): array
    {
        $from = Carbon::today()->subDays($days - 1);
        $counts = ServerVote::query()
            ->where('gta_server_id', $server->id)
            ->where('voted_on', '>=', $from->toDateString())
            ->selectRaw('voted_on, count(*) as total')
            ->groupBy('voted_on')
            ->pluck('total', 'voted_on');

        $rows = [];
        for ($day = $from->copy(); $day->lte(Carbon::today()); $day->addDay()) {
            $key = $day->toDateString();
            $rows[] = ['date' => $key, 'votes' => (int) ($counts[$key] ?? 0)];
        }

        return $rows;
    }

    /** Скільки разів людина голосувала (для досвіду й бейджа). */
    public function countFor(User $user): int
    {
        return ServerVote::query()->where('user_id', $user->id)->count();
    }
}
