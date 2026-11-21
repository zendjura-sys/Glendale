<?php

namespace App\Jobs;

use App\Models\Movie;
use App\Models\User;
use App\Notifications\EpisodeNotice;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Повідомити всіх, у кого тайтл у «Дивлюся», що вийшли нові серії. Кожну серію — один раз
 * (кеш на 30 днів), щоб повторний імпорт чи відкат лічильника не надсилав те саме знову.
 */
class NotifyNewEpisodes implements ShouldQueue
{
    use Queueable;

    public int $timeout = 600;

    public function __construct(public readonly int $movieId, public readonly int $from, public readonly int $to) {}

    public function handle(): void
    {
        $movie = Movie::query()->find($this->movieId);
        if ($movie === null || ! $movie->is_published || $this->to <= 0) {
            return;
        }
        // Перша серія з нових, яку ще не оголошували.
        $start = max($this->from + 1, (int) Cache::get("episodes:announced:{$movie->id}", 0) + 1);
        if ($start > $this->to) {
            return;
        }
        Cache::put("episodes:announced:{$movie->id}", $this->to, now()->addDays(30));

        DB::table('movie_user')->where('movie_id', $movie->id)->where('status', 'watching')->orderBy('user_id')
            ->pluck('user_id')->chunk(500)->each(function ($ids) use ($movie, $start) {
                User::query()->whereIn('id', $ids)->whereNull('banned_at')->get()
                    ->each(fn (User $u) => $u->notify(new EpisodeNotice($movie, $start, $this->to)));
            });
    }
}
