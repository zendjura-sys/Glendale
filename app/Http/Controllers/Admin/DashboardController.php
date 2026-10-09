<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Friendship;
use App\Models\Like;
use App\Models\Post;
use App\Models\User;
use App\Support\Modules\ModuleManager;
use Carbon\CarbonImmutable;
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
