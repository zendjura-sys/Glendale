<?php

namespace App\Services\Moderation;

use App\Models\Appeal;
use App\Models\MessageReport;
use App\Models\UserReport;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Публічний звіт прозорості: що модерація зробила за квартал. Лише загальні числа —
 * ні імен, ні текстів. Рахується з журналів модерації й кешується на годину.
 */
class TransparencyReport
{
    /**
     * Останні квартали (поточний — неповний).
     *
     * @return list<array{key: string, label: string, current: bool}>
     */
    public function quarters(int $count = 6): array
    {
        $now = CarbonImmutable::now('Europe/Kyiv');
        $out = [];
        for ($i = 0; $i < $count; $i++) {
            $q = $now->subQuarters($i);
            $out[] = ['key' => $q->year.'-Q'.$q->quarter, 'label' => "{$q->quarter} квартал {$q->year}", 'current' => $i === 0];
        }

        return $out;
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function range(string $key): array
    {
        abort_unless(preg_match('/^(\d{4})-Q([1-4])$/', $key, $m) === 1, 404);
        $start = CarbonImmutable::create((int) $m[1], ((int) $m[2] - 1) * 3 + 1, 1, 0, 0, 0, 'Europe/Kyiv');

        return [$start, $start->addQuarter()];
    }

    /**
     * @return array<string, mixed>
     */
    public function for(string $key): array
    {
        return Cache::remember("transparency.{$key}", 3600, function () use ($key) {
            [$from, $to] = $this->range($key);
            $between = fn (string $col) => fn ($q) => $q->where($col, '>=', $from)->where($col, '<', $to);

            $reasons = [];
            foreach ([UserReport::class, MessageReport::class] as $model) {
                foreach ($model::query()->tap($between('created_at'))->selectRaw('reason, count(*) as n')->groupBy('reason')->pluck('n', 'reason') as $reason => $n) {
                    $reasons[$reason] = ($reasons[$reason] ?? 0) + (int) $n;
                }
            }
            arsort($reasons);
            $reports = fn (string $status) => UserReport::query()->tap($between('created_at'))->where('status', $status)->count()
                + MessageReport::query()->tap($between('created_at'))->where('status', $status)->count();

            $appeals = Appeal::query()->tap($between('created_at'));
            $handled = Appeal::query()->tap($between('created_at'))->where('status', '!=', Appeal::PENDING)->get(['created_at', 'updated_at'])
                ->map(fn ($a) => $a->created_at->diffInHours($a->updated_at, true))->sort()->values();

            $hidden = DB::table('comments')->tap($between('hidden_at'));

            return [
                'key' => $key,
                'from' => $from->toDateString(),
                'to' => $to->subDay()->toDateString(),
                'reports' => [
                    'total' => array_sum($reasons),
                    'resolved' => $reports(UserReport::RESOLVED),
                    'dismissed' => $reports(UserReport::DISMISSED),
                    'pending' => $reports(UserReport::PENDING),
                    'reasons' => collect($reasons)->map(fn ($n, $r) => ['reason' => $r, 'count' => $n])->values()->all(),
                ],
                'actions' => [
                    'strikes' => DB::table('user_strikes')->tap($between('created_at'))->count(),
                    'strikes_revoked' => DB::table('user_strikes')->tap($between('revoked_at'))->count(),
                    'bans' => DB::table('users')->tap($between('banned_at'))->count(),
                    'ip_bans' => DB::table('ip_bans')->tap($between('created_at'))->count(),
                    'comments_hidden' => (clone $hidden)->count(),
                    'comments_restored' => (clone $hidden)->whereNotNull('restored_by')->count()
                        + DB::table('comments')->whereNull('hidden_at')->whereNotNull('restored_by')->tap($between('updated_at'))->count(),
                ],
                'spam' => DB::table('spam_blocks')->tap($between('created_at'))->selectRaw('kind, count(*) as n')->groupBy('kind')->orderByDesc('n')
                    ->get()->map(fn ($r) => ['kind' => $r->kind, 'count' => (int) $r->n])->values()->all(),
                'appeals' => [
                    'total' => (clone $appeals)->count(),
                    'accepted' => (clone $appeals)->where('status', Appeal::ACCEPTED)->count(),
                    'rejected' => (clone $appeals)->where('status', Appeal::REJECTED)->count(),
                    'median_hours' => $handled->isEmpty() ? null : (int) round($handled[intdiv($handled->count(), 2)]),
                    'sla_hours' => Appeal::SLA_HOURS,
                ],
                'verification' => [
                    'requests' => DB::table('verification_requests')->tap($between('created_at'))->count(),
                    'approved' => DB::table('verification_requests')->tap($between('decided_at'))->where('status', 'approved')->count(),
                ],
            ];
        });
    }
}
