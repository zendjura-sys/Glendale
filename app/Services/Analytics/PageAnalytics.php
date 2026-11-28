<?php

namespace App\Services\Analytics;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Аналітика сторінок (№288): скільки разів відкрили сторінку, скільки різних людей і звідки
 * прийшли — з GameCon, з пошукової системи чи з іншого сайту. Гість — це хеш (IP + браузер +
 * день + ключ сайту), сам IP не зберігається; хеші живуть 3 дні.
 */
class PageAnalytics
{
    private const TZ = 'Europe/Kyiv';

    private const SEARCH_ENGINES = ['google.', 'bing.com', 'duckduckgo.com', 'yahoo.', 'ecosia.org', 'search.brave.com', 'yandex.'];

    public function record(Request $request, string $type, int $id): void
    {
        // Боти й підвантаження частин сторінки (Inertia partial) — не перегляди.
        if ($request->headers->has('X-Inertia-Partial-Data') || preg_match('/bot|crawl|spider|preview|curl|wget|python|headless/i', (string) $request->userAgent()) === 1) {
            return;
        }
        $day = Carbon::now(self::TZ)->toDateString();
        $visitor = $request->user()?->id !== null
            ? 'u'.$request->user()->id
            : substr(hash_hmac('sha256', $request->ip().'|'.$request->userAgent().'|'.$day, (string) config('app.key')), 0, 32);
        $key = ['subject_type' => $type, 'subject_id' => $id, 'day' => $day];

        DB::table('page_views')->insertOrIgnore($key);
        $fresh = DB::table('page_visitors')->insertOrIgnore([...$key, 'visitor' => $visitor]) > 0;
        $update = ['views' => DB::raw('views + 1')];
        // Унікальний відвідувач — і в загальну кількість, і в джерело, звідки він прийшов.
        if ($fresh) {
            $update['uniques'] = DB::raw('uniques + 1');
            match ($this->source($request)) {
                'inside' => $update['from_inside'] = DB::raw('from_inside + 1'),
                'search' => $update['from_search'] = DB::raw('from_search + 1'),
                default => $update['from_outside'] = DB::raw('from_outside + 1'),
            };
        }
        DB::table('page_views')->where($key)->update($update);
    }

    /** Звідки прийшов: з GameCon (inside), з пошуковика (search) чи ззовні/напряму (outside). */
    public function source(Request $request): string
    {
        $referer = (string) $request->headers->get('referer', '');
        $host = (string) parse_url($referer, PHP_URL_HOST);
        if ($host === '') {
            return 'outside';
        }
        $own = (string) parse_url((string) config('app.url'), PHP_URL_HOST);
        if ($host === $own || $host === $request->getHost()) {
            return 'inside';
        }
        foreach (self::SEARCH_ENGINES as $engine) {
            if (str_contains($host, $engine)) {
                return 'search';
            }
        }

        return 'outside';
    }

    /**
     * Звіт за останні N днів: підсумки, щоденний ряд і джерела (за унікальними відвідувачами).
     *
     * @return array{views: int, uniques: int, days: list<array{day: string, views: int, uniques: int}>, sources: array{inside: int, search: int, outside: int}}
     */
    public function report(string $type, int $id, int $days = 30): array
    {
        $from = Carbon::now(self::TZ)->subDays($days - 1)->toDateString();
        $rows = DB::table('page_views')->where('subject_type', $type)->where('subject_id', $id)->where('day', '>=', $from)
            ->get()->keyBy(fn ($row) => substr((string) $row->day, 0, 10));
        $series = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = Carbon::now(self::TZ)->subDays($i)->toDateString();
            $row = $rows->get($day);
            $series[] = ['day' => $day, 'views' => (int) ($row->views ?? 0), 'uniques' => (int) ($row->uniques ?? 0)];
        }

        return [
            'views' => (int) $rows->sum('views'),
            'uniques' => (int) $rows->sum('uniques'),
            'days' => $series,
            'sources' => [
                'inside' => (int) $rows->sum('from_inside'),
                'search' => (int) $rows->sum('from_search'),
                'outside' => (int) $rows->sum('from_outside'),
            ],
        ];
    }

    /** Нічне прибирання: хеші відвідувачів старші 3 днів, денні підсумки — старші за рік. */
    public function prune(): void
    {
        DB::table('page_visitors')->where('day', '<', Carbon::now(self::TZ)->subDays(3)->toDateString())->delete();
        DB::table('page_views')->where('day', '<', Carbon::now(self::TZ)->subYear()->toDateString())->delete();
    }
}
