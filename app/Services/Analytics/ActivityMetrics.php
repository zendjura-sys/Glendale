<?php

namespace App\Services\Analytics;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Метрики активності: DAU/WAU/MAU (сайт і застосунок), утримання за тижнями реєстрації
 * й топ розділів за унікальними людьми. Запис — раз на добу на людину (кеш відсікає повтори).
 */
class ActivityMetrics
{
    /** Розділи сайту за першою частиною адреси. */
    public const SECTIONS = [
        'feed' => 'Стрічка', 'messages' => 'Повідомлення', 'friends' => 'Друзі', 'people' => 'Люди',
        'communities' => 'Спільноти', 'c' => 'Спільноти', 'music' => 'Музика', 'cinema' => 'Кіно',
        'games' => 'Ігри', 'servers' => 'Сервери GTA', 'families' => 'Сім’ї', 'clans' => 'Клани',
        'shows' => 'GameCast', 'party' => 'Паті', 'quests' => 'Завдання', 'notifications' => 'Сповіщення',
        'settings' => 'Налаштування', 'search' => 'Пошук', 'photos' => 'Фото', 'articles' => 'Статті',
        'tierlists' => 'Тір-листи', 'support' => 'Підтримка', 'pricing' => 'GameCon+', 'phone' => 'Телефон',
    ];

    public const KEEP_SECTION_DAYS = 120;

    public function touch(User $user, string $platform, ?Request $request = null): void
    {
        $day = now('Europe/Kyiv')->toDateString();
        if (Cache::add("act:{$user->id}:{$day}:{$platform}", 1, now()->addHours(26))) {
            DB::table('user_active_days')->insertOrIgnore(['user_id' => $user->id, 'day' => $day, 'platform' => $platform]);
        }
        // Розділ — лише для переходів між сторінками сайту (не для фонових запитів).
        if ($request !== null && $platform === 'web' && $request->isMethod('GET') && ! $request->expectsJson()) {
            $section = $this->section($request->path());
            if ($section !== null && Cache::add("sec:{$user->id}:{$day}:{$section}", 1, now()->addHours(26))) {
                DB::table('section_visits')->insertOrIgnore(['day' => $day, 'section' => $section, 'user_id' => $user->id]);
            }
        }
    }

    public function section(string $path): ?string
    {
        $first = explode('/', trim($path, '/'))[0] ?? '';

        return isset(self::SECTIONS[$first]) ? ($first === 'c' ? 'communities' : $first) : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function report(int $days = 30): array
    {
        $today = now('Europe/Kyiv')->startOfDay();
        $from = $today->subDays($days - 1)->toDateString();
        $count = fn (string $since, ?string $platform = null) => (int) DB::table('user_active_days')->where('day', '>=', $since)
            ->when($platform, fn ($q, string $p) => $q->where('platform', $p))->distinct()->count('user_id');

        $dau = $count($today->toDateString());
        $mau = $count($today->subDays(29)->toDateString());

        $rows = DB::table('user_active_days')->where('day', '>=', $from)->select('day', 'platform', DB::raw('count(*) as n'))->groupBy('day', 'platform')->get();
        $totals = DB::table('user_active_days')->where('day', '>=', $from)->select('day', DB::raw('count(distinct user_id) as n'))->groupBy('day')->pluck('n', 'day');
        $signups = DB::table('users')->where('created_at', '>=', $from)->select(DB::raw('date(created_at) as day'), DB::raw('count(*) as n'))->groupBy('day')->pluck('n', 'day');
        $daily = [];
        for ($i = 0; $i < $days; $i++) {
            $d = $today->subDays($days - 1 - $i)->toDateString();
            $daily[] = [
                'day' => $d,
                'total' => (int) ($totals[$d] ?? 0),
                'web' => (int) ($rows->first(fn ($r) => (string) $r->day === $d && $r->platform === 'web')->n ?? 0),
                'app' => (int) ($rows->first(fn ($r) => (string) $r->day === $d && $r->platform === 'app')->n ?? 0),
                'signups' => (int) ($signups[$d] ?? 0),
            ];
        }

        return [
            'dau' => $dau,
            'wau' => $count($today->subDays(6)->toDateString()),
            'mau' => $mau,
            'stickiness' => $mau > 0 ? (int) round($dau * 100 / $mau) : 0,
            'app_share' => $mau > 0 ? (int) round($count($today->subDays(29)->toDateString(), 'app') * 100 / $mau) : 0,
            'signups_week' => (int) DB::table('users')->where('created_at', '>=', $today->subDays(6))->count(),
            'daily' => $daily,
            'retention' => $this->retention(),
            'sections' => $this->sections(),
        ];
    }

    /**
     * Утримання: тижневі когорти реєстрації (8 тижнів) і частка активних у тижні 1…7 після.
     *
     * @return list<array{week: string, size: int, weeks: list<int|null>}>
     */
    private function retention(): array
    {
        $start = now('Europe/Kyiv')->startOfWeek()->subWeeks(7);
        $out = [];
        for ($w = 0; $w < 8; $w++) {
            $from = $start->addWeeks($w);
            $ids = DB::table('users')->whereBetween('created_at', [$from, $from->addWeek()])->pluck('id');
            $weeks = [];
            for ($n = 1; $n <= 7; $n++) {
                $at = $from->addWeeks($n);
                if ($at->isFuture() || $ids->isEmpty()) {
                    $weeks[] = null;

                    continue;
                }
                $active = DB::table('user_active_days')->whereIn('user_id', $ids)
                    ->whereBetween('day', [$at->toDateString(), $at->addDays(6)->toDateString()])->distinct()->count('user_id');
                $weeks[] = (int) round($active * 100 / $ids->count());
            }
            $out[] = ['week' => $from->toDateString(), 'size' => $ids->count(), 'weeks' => $weeks];
        }

        return $out;
    }

    /**
     * @return list<array{key: string, label: string, users: int, share: int}>
     */
    private function sections(): array
    {
        $since = now('Europe/Kyiv')->subDays(6)->toDateString();
        $active = max(1, (int) DB::table('user_active_days')->where('day', '>=', $since)->where('platform', 'web')->distinct()->count('user_id'));

        return DB::table('section_visits')->where('day', '>=', $since)
            ->select('section', DB::raw('count(distinct user_id) as n'))->groupBy('section')->orderByDesc('n')->limit(15)->get()
            ->map(fn ($r) => ['key' => (string) $r->section, 'label' => self::SECTIONS[$r->section] ?? (string) $r->section, 'users' => (int) $r->n, 'share' => min(100, (int) round($r->n * 100 / $active))])
            ->values()->all();
    }

    public function prune(): int
    {
        return DB::table('section_visits')->where('day', '<', now()->subDays(self::KEEP_SECTION_DAYS)->toDateString())->delete();
    }
}
