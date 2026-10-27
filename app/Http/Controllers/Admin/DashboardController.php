<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Friendship;
use App\Models\Like;
use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use App\Support\Modules\ModuleManager;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(ModuleManager $modules): Response
    {
        $days = 30;
        $from = CarbonImmutable::today()->subDays($days - 1);

        return Inertia::render('admin/dashboard', [
            'stats' => [
                'users' => User::query()->count(),
                'users_today' => User::query()->where('created_at', '>=', today())->count(),
                'online' => User::query()->where('last_seen_at', '>=', now()->subMinutes(5))->count(),
                'active_week' => User::query()->where('last_seen_at', '>=', now()->subWeek())->count(),
                'posts' => Post::query()->count(),
                'posts_today' => Post::query()->where('created_at', '>=', today())->count(),
                'comments' => Comment::query()->count(),
                'likes' => Like::query()->count(),
                'friendships' => Friendship::query()->where('status', Friendship::ACCEPTED)->count(),
                'banned' => User::query()->whereNotNull('banned_at')->count(),
                'modules_enabled' => $modules->all()->where('enabled', true)->count(),
                'modules_total' => $modules->all()->count(),
            ],
            'chart' => Inertia::defer(fn () => $this->chart($from, $days)),
            'heatmap' => Inertia::defer(fn () => Cache::remember('admin.heatmap', now()->addMinutes(30), fn () => $this->heatmap()), 'heatmap'),
            'latestUsers' => User::query()->latest()->limit(6)->get()
                ->map(fn (User $u) => [...$u->toCard(), 'created_at' => $u->created_at?->toIso8601String()])
                ->all(),
            'latestPosts' => Post::query()->with('author')->latest()->limit(5)->get()
                ->map(fn (Post $p) => [
                    'id' => $p->id,
                    'body' => str($p->body)->limit(120)->toString(),
                    'author' => $p->author->toCard(),
                    'likes_count' => $p->likes_count,
                    'comments_count' => $p->comments_count,
                    'created_at' => $p->created_at->toIso8601String(),
                ])->all(),
            'system' => [
                'php' => PHP_VERSION,
                'laravel' => app()->version(),
                'environment' => app()->environment(),
                'database' => DB::connection()->getDriverName(),
                'cache' => config('cache.default'),
                'queue' => config('queue.default'),
            ],
        ]);
    }

    /**
     * Теплова карта активності за 4 тижні: дні тижня (пн–нд) × години за Києвом.
     * Рахуються пости, коментарі, вподобання й повідомлення; у БД групуємо за годиною UTC,
     * а в київський час переводимо тут (з урахуванням переходу на літній час).
     *
     * @return array{grid: list<list<int>>, max: int, peak: array{day: int, hour: int}|null, total: int}
     */
    private function heatmap(): array
    {
        $from = now()->subDays(28)->startOfHour();
        $bucket = match (DB::connection()->getDriverName()) {
            'mysql', 'mariadb' => "DATE_FORMAT(created_at, '%Y-%m-%d %H')",
            'pgsql' => "to_char(created_at, 'YYYY-MM-DD HH24')",
            default => "strftime('%Y-%m-%d %H', created_at)",
        };
        $grid = array_fill(0, 7, array_fill(0, 24, 0));
        foreach ([Post::query(), Comment::query(), Like::query(), Message::query()] as $query) {
            $rows = $query->where('created_at', '>=', $from)->selectRaw("{$bucket} as h, COUNT(*) as c")->groupBy('h')->pluck('c', 'h');
            foreach ($rows as $hour => $count) {
                $at = CarbonImmutable::createFromFormat('Y-m-d H', (string) $hour, 'UTC');
                if ($at === null) {
                    continue;
                }
                $local = $at->setTimezone('Europe/Kyiv');
                $grid[$local->dayOfWeekIso - 1][$local->hour] += (int) $count;
            }
        }
        $max = 0;
        $peak = null;
        foreach ($grid as $day => $hours) {
            foreach ($hours as $hour => $count) {
                if ($count > $max) {
                    $max = $count;
                    $peak = ['day' => $day, 'hour' => $hour];
                }
            }
        }

        return ['grid' => array_values(array_map('array_values', $grid)), 'max' => $max, 'peak' => $peak, 'total' => array_sum(array_map('array_sum', $grid))];
    }

    /**
     * @return list<array{date: string, users: int, posts: int}>
     */
    private function chart(CarbonImmutable $from, int $days): array
    {
        $users = User::query()
            ->where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as d, COUNT(*) as c')
            ->groupBy('d')
            ->pluck('c', 'd');

        $posts = Post::query()
            ->where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as d, COUNT(*) as c')
            ->groupBy('d')
            ->pluck('c', 'd');

        return array_values(collect(range(0, $days - 1))->map(function (int $offset) use ($from, $users, $posts) {
            $date = $from->addDays($offset)->toDateString();

            return ['date' => $date, 'users' => (int) ($users[$date] ?? 0), 'posts' => (int) ($posts[$date] ?? 0)];
        })->all());
    }
}
