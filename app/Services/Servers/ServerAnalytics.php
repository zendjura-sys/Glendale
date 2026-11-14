<?php

namespace App\Services\Servers;

use App\Models\Family;
use App\Models\GtaServer;
use App\Models\PlayedPlace;
use App\Models\ServerVote;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Перегляди сторінки сервера й переходи (підключитися, Discord, сайт, Telegram) — по днях.
 * Один перегляд від людини за годину; власника не рахуємо.
 */
class ServerAnalytics
{
    public const CLICKS = ['connect', 'discord', 'website', 'telegram'];

    /** Звідки прийшли на сторінку сервера. */
    public const SOURCES = ['catalog', 'search', 'feed', 'gamecon', 'external', 'direct'];

    public function view(GtaServer $server, ?User $viewer, ?string $referer = null): void
    {
        if ($viewer === null || $viewer->id === $server->owner_id || ! Cache::add("server-view:{$server->id}:{$viewer->id}", 1, now()->addHour())) {
            return;
        }
        $this->bump($server, 'views');
        $day = Carbon::today()->toDateString();
        $source = self::source($referer);
        DB::table('server_view_sources')->insertOrIgnore(['gta_server_id' => $server->id, 'day' => $day, 'source' => $source, 'views' => 0]);
        DB::table('server_view_sources')->where(['gta_server_id' => $server->id, 'day' => $day, 'source' => $source])->increment('views');
    }

    /** Джерело переходу за Referer: каталог серверів, пошуковик, стрічка, інша сторінка GameCon, інший сайт, напряму. */
    public static function source(?string $referer): string
    {
        if ($referer === null || $referer === '') {
            return 'direct';
        }
        $host = strtolower((string) parse_url($referer, PHP_URL_HOST));
        $path = (string) parse_url($referer, PHP_URL_PATH);
        $own = strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST));
        if ($host !== '' && ($host === $own || $host === request()->getHost())) {
            return match (true) {
                $path === '/servers' || str_starts_with($path, '/servers?') || $path === '/servers/' => 'catalog',
                $path === '/feed' || str_starts_with($path, '/posts/') => 'feed',
                default => 'gamecon',
            };
        }
        if (preg_match('/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave)\./', $host) === 1) {
            return 'search';
        }

        return 'external';
    }

    public function click(GtaServer $server, User $user, string $kind): void
    {
        if (! in_array($kind, self::CLICKS, true) || ! Cache::add("server-click:{$server->id}:{$user->id}:{$kind}", 1, now()->addMinutes(10))) {
            return;
        }
        $this->bump($server, $kind);
    }

    /**
     * Зведення за 30 днів для власника.
     *
     * @return array{days: list<array{date: string, views: int, clicks: int}>, totals: array<string, int>, previous_views: int, sources: array<string, int>}
     */
    public function summary(GtaServer $server, int $days = 30): array
    {
        $from = Carbon::today()->subDays($days - 1);
        $rows = DB::table('server_stats')->where('gta_server_id', $server->id)->where('day', '>=', $from->copy()->subDays($days)->toDateString())->get()
            ->keyBy(fn ($row) => Carbon::parse($row->day)->toDateString());

        $series = [];
        $totals = array_fill_keys(['views', ...self::CLICKS], 0);
        $previous = 0;
        foreach ($rows as $date => $row) {
            if ($date < $from->toDateString()) {
                $previous += (int) $row->views;
            }
        }
        for ($day = $from->copy(); $day->lte(Carbon::today()); $day->addDay()) {
            $row = $rows->get($day->toDateString());
            $clicks = 0;
            foreach (self::CLICKS as $kind) {
                $value = (int) ($row->{$kind} ?? 0);
                $totals[$kind] += $value;
                $clicks += $value;
            }
            $totals['views'] += (int) ($row->views ?? 0);
            $series[] = ['date' => $day->toDateString(), 'views' => (int) ($row->views ?? 0), 'clicks' => $clicks];
        }
        $totals['votes'] = ServerVote::query()->where('gta_server_id', $server->id)->where('voted_on', '>=', $from->toDateString())->count();
        $totals['playing'] = PlayedPlace::query()->where('kind', PlayedPlace::SERVER)->where('subject_id', $server->id)->count();
        $totals['families'] = Family::query()->where('server_id', $server->id)->where('status', Family::STATUS_VERIFIED)->count();

        $sources = DB::table('server_view_sources')->where('gta_server_id', $server->id)->where('day', '>=', $from->toDateString())
            ->groupBy('source')->selectRaw('source, SUM(views) as views')->pluck('views', 'source');
        $bySource = [];
        foreach (self::SOURCES as $source) {
            $bySource[$source] = (int) ($sources[$source] ?? 0);
        }

        return ['days' => $series, 'totals' => $totals, 'previous_views' => $previous, 'sources' => $bySource];
    }

    private function bump(GtaServer $server, string $column): void
    {
        $day = Carbon::today()->toDateString();
        DB::table('server_stats')->insertOrIgnore(['gta_server_id' => $server->id, 'day' => $day]);
        DB::table('server_stats')->where('gta_server_id', $server->id)->where('day', $day)->increment($column);
    }
}
