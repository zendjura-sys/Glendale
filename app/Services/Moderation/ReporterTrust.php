<?php

namespace App\Services\Moderation;

use App\Models\MessageReport;
use App\Models\User;
use App\Models\UserReport;
use Illuminate\Support\Facades\DB;

/**
 * Довірені скаржники: хто часто скаржиться по ділу (≥10 розглянутих, ≥80% підтверджено),
 * чиї скарги піднімаються в черзі. Адміністратор може позначити вручну чи зняти позначку.
 */
class ReporterTrust
{
    public const MIN_REPORTS = 10;

    public const MIN_ACCURACY = 0.8;

    /**
     * @param  list<int>  $userIds
     * @return array<int, array{resolved: int, dismissed: int, trusted: bool, manual: bool|null}>
     */
    public function for(array $userIds): array
    {
        $userIds = array_values(array_unique(array_filter($userIds)));
        if ($userIds === []) {
            return [];
        }
        $counts = [];
        foreach ([MessageReport::query()->getModel()->getTable(), UserReport::query()->getModel()->getTable()] as $table) {
            $rows = DB::table($table)->whereIn('reporter_id', $userIds)->whereIn('status', ['resolved', 'dismissed'])
                ->selectRaw('reporter_id, status, count(*) as total')->groupBy('reporter_id', 'status')->get();
            foreach ($rows as $row) {
                $counts[(int) $row->reporter_id][(string) $row->status] = ($counts[(int) $row->reporter_id][(string) $row->status] ?? 0) + (int) $row->total;
            }
        }
        $manual = User::query()->whereIn('id', $userIds)->get(['id', 'preferences'])
            ->mapWithKeys(fn (User $u) => [$u->id => is_bool($v = $u->pref('trusted_reporter')) ? $v : null])->all();

        $result = [];
        foreach ($userIds as $id) {
            $resolved = $counts[$id]['resolved'] ?? 0;
            $dismissed = $counts[$id]['dismissed'] ?? 0;
            $total = $resolved + $dismissed;
            $earned = $total >= self::MIN_REPORTS && $resolved / max(1, $total) >= self::MIN_ACCURACY;
            $result[$id] = ['resolved' => $resolved, 'dismissed' => $dismissed, 'trusted' => $manual[$id] ?? $earned, 'manual' => $manual[$id] ?? null];
        }

        return $result;
    }

    /**
     * Найактивніші скаржники за 90 днів — для ручної позначки довіри.
     *
     * @return list<array<string, mixed>>
     */
    public function leaders(int $limit = 15): array
    {
        $ids = DB::table((new MessageReport)->getTable())->where('created_at', '>=', now()->subDays(90))->pluck('reporter_id')
            ->merge(DB::table((new UserReport)->getTable())->where('created_at', '>=', now()->subDays(90))->pluck('reporter_id'))
            ->countBy()->sortDesc()->keys()->take($limit)->map(fn ($id) => (int) $id)->values()->all();
        $ids = array_values($ids);
        $stats = $this->for($ids);
        $users = User::query()->whereIn('id', $ids)->get()->keyBy('id');

        return array_values(array_filter(array_map(fn (int $id) => $users->has($id) ? [...$users[$id]->toCard(), ...$stats[$id]] : null, $ids)));
    }
}
