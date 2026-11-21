<?php

namespace App\Services\Cinema;

use App\Models\Movie;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * «Тайтл тижня»: шість кандидатів — найпопулярніше в глядачів за тиждень; один голос на людину,
 * його можна перенести. Переможець минулого тижня показується зі значком.
 */
class MovieOfWeek
{
    public const CANDIDATES = 6;

    public static function week(?CarbonInterface $at = null): string
    {
        $at ??= now('Europe/Kyiv');

        return $at->format('o-\WW');
    }

    /**
     * @return list<int>
     */
    public function candidateIds(): array
    {
        $week = self::week();

        /** @var list<int> */
        return Cache::remember("movie-week.candidates.{$week}", now()->addHours(6), function () {
            $start = now('Europe/Kyiv')->startOfWeek()->subWeek();
            $ids = DB::table('movie_user')->where('updated_at', '>=', $start)
                ->selectRaw('movie_id, count(*) as total')->groupBy('movie_id')->orderByDesc('total')
                ->limit(self::CANDIDATES * 2)->pluck('movie_id')->map(fn ($id) => (int) $id)->all();
            $ids = Movie::query()->published()->whereIn('id', $ids)->pluck('id')->map(fn ($id) => (int) $id)
                ->sortBy(fn (int $id) => array_search($id, $ids, true))->take(self::CANDIDATES)->values()->all();
            if (count($ids) < self::CANDIDATES) {
                $ids = [...$ids, ...Movie::query()->published()->whereNotIn('id', $ids ?: [0])->orderByDesc('views_count')
                    ->limit(self::CANDIDATES - count($ids))->pluck('id')->map(fn ($id) => (int) $id)->all()];
            }

            return $ids;
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function board(?User $user): array
    {
        $week = self::week();
        $ids = $this->candidateIds();
        $votes = DB::table('movie_week_votes')->where('week', $week)->selectRaw('movie_id, count(*) as total')
            ->groupBy('movie_id')->pluck('total', 'movie_id');
        $total = (int) $votes->sum();
        $mine = $user ? DB::table('movie_week_votes')->where('week', $week)->where('user_id', $user->id)->value('movie_id') : null;
        $movies = Movie::query()->whereIn('id', $ids ?: [0])->get()->keyBy('id');

        return [
            'week' => $week,
            'ends_at' => now('Europe/Kyiv')->endOfWeek()->toIso8601String(),
            'total' => $total,
            'mine' => $mine !== null ? (int) $mine : null,
            'candidates' => collect($ids)->filter(fn (int $id) => $movies->has($id))->map(fn (int $id) => [
                ...$movies[$id]->toCard(),
                'votes' => (int) ($votes[$id] ?? 0),
                'percent' => $total > 0 ? (int) round(((int) ($votes[$id] ?? 0)) / $total * 100) : 0,
            ])->values()->all(),
            'winner' => $this->lastWinner(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function lastWinner(): ?array
    {
        $week = self::week(now('Europe/Kyiv')->subWeek());

        return Cache::remember("movie-week.winner.{$week}", now()->addHours(6), function () use ($week) {
            $row = DB::table('movie_week_votes')->where('week', $week)->selectRaw('movie_id, count(*) as total')
                ->groupBy('movie_id')->orderByDesc('total')->first();
            $movie = $row ? Movie::query()->find($row->movie_id) : null;

            return $movie ? [...$movie->toCard(), 'votes' => (int) $row->total, 'week' => $week] : null;
        });
    }

    public function vote(User $user, Movie $movie): void
    {
        if (! in_array($movie->id, $this->candidateIds(), true)) {
            throw ValidationException::withMessages(['movie' => 'Цей тайтл не бере участі в голосуванні цього тижня.']);
        }
        DB::table('movie_week_votes')->updateOrInsert(
            ['week' => self::week(), 'user_id' => $user->id],
            ['movie_id' => $movie->id, 'updated_at' => now(), 'created_at' => now()],
        );
    }
}
