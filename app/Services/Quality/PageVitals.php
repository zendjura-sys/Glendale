<?php

namespace App\Services\Quality;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Монітор швидкості сторінок: браузери надсилають LCP, INP, CLS і TTFB, тут — p75 за сторінками
 * й пристроями та оцінка за порогами Google (добре / потребує уваги / погано).
 */
class PageVitals
{
    public const METRICS = ['LCP', 'INP', 'CLS', 'TTFB'];

    public const DEVICES = ['mobile', 'tablet', 'desktop'];

    /** Пороги «добре» / «погано» (мс, для CLS — частки). */
    public const THRESHOLDS = [
        'LCP' => [2500, 4000],
        'INP' => [200, 500],
        'CLS' => [0.1, 0.25],
        'TTFB' => [800, 1800],
    ];

    /** Скільки днів тримаємо замірів. */
    public const KEEP_DAYS = 30;

    /**
     * @param  list<array{metric: string, value: float|int}>  $samples
     */
    public function record(string $page, string $device, array $samples): void
    {
        $rows = [];
        foreach ($samples as $s) {
            if (! in_array($s['metric'], self::METRICS, true)) {
                continue;
            }
            // Відкидаємо явні збої вимірювання (вкладка у фоні тощо).
            $max = $s['metric'] === 'CLS' ? 10 : 60000;
            if ($s['value'] < 0 || $s['value'] > $max) {
                continue;
            }
            $rows[] = ['page' => $page, 'metric' => $s['metric'], 'value' => round((float) $s['value'], 4), 'device' => $device, 'created_at' => now()];
        }
        if ($rows !== []) {
            DB::table('page_vitals')->insert($rows);
        }
    }

    /**
     * Зведення за $days днів: загальні p75 і таблиця сторінок (найповільніші за LCP — вгорі).
     *
     * @return array<string, mixed>
     */
    public function report(int $days, ?string $device = null): array
    {
        $rows = DB::table('page_vitals')->where('created_at', '>=', now()->subDays($days))
            ->when($device, fn ($q, string $d) => $q->where('device', $d))
            ->orderByDesc('id')->limit(50000)->get(['page', 'metric', 'value']);

        $overall = [];
        foreach (self::METRICS as $metric) {
            $overall[$metric] = $this->summary($metric, $rows->where('metric', $metric)->pluck('value'));
        }

        $pages = $rows->groupBy('page')->map(function (Collection $items, string $page) {
            $out = ['page' => $page, 'samples' => $items->where('metric', 'LCP')->count() ?: $items->count()];
            foreach (self::METRICS as $metric) {
                $out[$metric] = $this->summary($metric, $items->where('metric', $metric)->pluck('value'));
            }

            return $out;
        })->sortByDesc(fn (array $p) => $p['LCP']['p75'] ?? -1)->values()->take(60)->all();

        // Динаміка p75 LCP та INP по днях.
        $daily = DB::table('page_vitals')->where('created_at', '>=', now()->subDays($days))
            ->when($device, fn ($q, string $d) => $q->where('device', $d))
            ->whereIn('metric', ['LCP', 'INP'])->orderByDesc('id')->limit(50000)->get(['metric', 'value', 'created_at'])
            ->groupBy(fn ($r) => substr((string) $r->created_at, 0, 10))
            ->map(fn (Collection $items, string $day) => [
                'day' => $day,
                'LCP' => $this->p75($items->where('metric', 'LCP')->pluck('value')),
                'INP' => $this->p75($items->where('metric', 'INP')->pluck('value')),
            ])->sortKeys()->values()->all();

        return ['overall' => $overall, 'pages' => $pages, 'daily' => $daily, 'thresholds' => self::THRESHOLDS];
    }

    public function prune(): int
    {
        return DB::table('page_vitals')->where('created_at', '<', now()->subDays(self::KEEP_DAYS))->delete();
    }

    /**
     * @param  Collection<int, mixed>  $values
     * @return array{p75: float|null, count: int, rating: string|null, good: int}
     */
    private function summary(string $metric, Collection $values): array
    {
        $p75 = $this->p75($values);
        [$good] = self::THRESHOLDS[$metric];

        return [
            'p75' => $p75,
            'count' => $values->count(),
            'rating' => $p75 === null ? null : $this->rating($metric, $p75),
            // Частка «добрих» замірів, %.
            'good' => $values->count() ? (int) round($values->filter(fn ($v) => (float) $v <= $good)->count() * 100 / $values->count()) : 0,
        ];
    }

    /** @param Collection<int, mixed> $values */
    private function p75(Collection $values): ?float
    {
        if ($values->isEmpty()) {
            return null;
        }
        $sorted = $values->map(fn ($v) => (float) $v)->sort()->values();

        return round($sorted[(int) floor(0.75 * ($sorted->count() - 1))], 3);
    }

    private function rating(string $metric, float $value): string
    {
        [$good, $poor] = self::THRESHOLDS[$metric];

        return $value <= $good ? 'good' : ($value <= $poor ? 'needs' : 'poor');
    }
}
