<?php

namespace App\Support;

use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Останні запити швидкого пошуку. Лише для власника акаунта.
 */
class RecentSearches
{
    /**
     * @return list<string>
     */
    public static function list(User $user): array
    {
        if (! app(Plugins::class)->on('recent_searches')) {
            return [];
        }
        $stored = $user->pref('recent_searches', []);
        if (! is_array($stored)) {
            return [];
        }

        return array_values(array_filter($stored, fn ($item) => is_string($item) && $item !== ''));
    }

    public static function remember(User $user, string $query): void
    {
        if (! app(Plugins::class)->on('recent_searches')) {
            return;
        }
        $query = trim($query);
        if (mb_strlen($query) < 2) {
            return;
        }
        $query = mb_substr($query, 0, 80);
        $recent = array_values(array_filter(
            self::list($user),
            fn (string $item) => mb_strtolower($item) !== mb_strtolower($query),
        ));
        array_unshift($recent, $query);
        $user->mergePref(['recent_searches' => array_slice($recent, 0, 8)]);
        self::count($user, $query);
    }

    /** Прибрати один запит з історії або всю історію (null). */
    public static function forget(User $user, ?string $query): void
    {
        $recent = $query === null ? [] : array_values(array_filter(
            self::list($user),
            fn (string $item) => mb_strtolower($item) !== mb_strtolower(trim($query)),
        ));
        $user->mergePref(['recent_searches' => $recent]);
    }

    /**
     * Частi запити сайту за тиждень (щонайменше троє людей), для підказок під час введення.
     * З префіксом — лише ті, що з нього починаються.
     *
     * @return list<string>
     */
    public static function trending(?string $prefix = null, int $limit = 6): array
    {
        $prefix = $prefix !== null ? mb_strtolower(trim($prefix)) : null;

        return DB::table('search_queries')->where('day', '>=', now()->subDays(7)->toDateString())
            ->when($prefix, fn ($q, string $p) => $q->where('q', 'like', str_replace(['%', '_'], ['\\%', '\\_'], $p).'%')->where('q', '!=', $p))
            ->select('q', DB::raw('sum(people) as n'))->groupBy('q')->having('n', '>=', 3)
            ->orderByDesc('n')->limit($limit)->pluck('q')->map(fn ($q) => (string) $q)->all();
    }

    /** Один запит — одна людина на день (кеш відсікає повтори). */
    private static function count(User $user, string $query): void
    {
        $q = mb_strtolower($query);
        $day = now()->toDateString();
        if (! Cache::add('search:q:'.md5($user->id.'|'.$q.'|'.$day), 1, now()->addDay())) {
            return;
        }
        DB::table('search_queries')->insertOrIgnore(['q' => $q, 'day' => $day, 'people' => 0]);
        DB::table('search_queries')->where('q', $q)->where('day', $day)->increment('people');
    }

    public static function prune(): int
    {
        return DB::table('search_queries')->where('day', '<', now()->subDays(30)->toDateString())->delete();
    }
}
