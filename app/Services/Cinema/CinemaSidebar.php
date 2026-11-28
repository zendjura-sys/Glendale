<?php

namespace App\Services\Cinema;

use App\Models\Comment;
use App\Models\Movie;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Бічна колонка кінопорталу: швидкі фільтри (жанри, роки, країни, типи) і віджети —
 * випадковий тайтл, популярне за тиждень/місяць, трейлери, свіжі коментарі, найобговорюване.
 */
class CinemaSidebar
{
    /**
     * @return array<string, mixed>
     */
    public function data(): array
    {
        $cached = Cache::remember('cinema.sidebar', now()->addMinutes(10), fn () => [
            'genres' => $this->safe(fn () => $this->genres()),
            'years' => $this->safe(fn () => Movie::query()->published()->whereNotNull('year')->distinct()->orderByDesc('year')->limit(20)->pluck('year')->map(fn ($y) => (int) $y)->values()->all()),
            'countries' => $this->safe(fn () => array_values(array_filter(array_keys(Movie::query()->published()->whereNotNull('countries')->pluck('countries')
                ->flatten()->filter(fn ($c) => is_string($c) && $c !== '')->countBy()->sortDesc()->take(9)->all()), 'is_string'))),
            'types' => collect(Movie::TYPES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'popular' => [
                'week' => $this->safe(fn () => $this->popular(7)),
                'month' => $this->safe(fn () => $this->popular(30)),
            ],
            'trailers' => $this->safe(fn () => Movie::query()->published()->whereNotNull('trailer_url')->latest('updated_at')->limit(3)->get()
                ->map(fn (Movie $m) => [...$m->toCard(), 'trailer_url' => $m->trailer_url])->values()->all()),
            'comments' => $this->safe(fn () => Comment::query()->with(['user', 'movie'])->whereNotNull('movie_id')->latest('id')->limit(4)->get()
                ->filter(fn (Comment $c) => $c->movie !== null && $c->movie->is_published)
                ->map(fn (Comment $c) => [
                    'id' => $c->id,
                    'body' => Str::limit((string) $c->body, 90),
                    'user' => $c->user?->toCard(),
                    'movie' => ['title' => $c->movie->title, 'href' => '/cinema/'.$c->movie->slug.'#comments'],
                ])->values()->all()),
            'discussed' => $this->safe(fn () => Movie::query()->published()->where('comments_count', '>', 0)
                ->orderByDesc('comments_count')->limit(6)->get()
                ->map(fn (Movie $m) => ['title' => $m->title, 'href' => '/cinema/'.$m->slug, 'count' => (int) $m->comments_count])->values()->all()),
        ]);

        $random = $this->safe(fn () => Movie::query()->published()->where(fn (Builder $q) => $q->whereNotNull('poster_url')->orWhereNotNull('poster_path'))->inRandomOrder()->first()?->toCard(), null);

        return [...$cached, 'random' => $random];
    }

    /**
     * Віджет не має права зламати сторінку: збій — у журнал помилок, а віджет просто порожній.
     *
     * @template T
     *
     * @param  callable(): T  $build
     * @param  T  $fallback
     * @return T
     */
    private function safe(callable $build, mixed $fallback = []): mixed
    {
        try {
            return $build();
        } catch (\Throwable $e) {
            report($e);

            return $fallback;
        }
    }

    /**
     * @return list<array{name: string, count: int}>
     */
    private function genres(): array
    {
        return array_values(Movie::query()->published()->whereNotNull('genres')->pluck('genres')->flatten()->filter()
            ->countBy()->sortDesc()->take(16)
            ->map(fn (int $count, string $name) => ['name' => $name, 'count' => $count])->all());
    }

    /**
     * Найпопулярніше за період: хто додавав до списків/дивився за ці дні; бракує — загальні перегляди.
     *
     * @return list<array<string, mixed>>
     */
    private function popular(int $days): array
    {
        $ids = DB::table('movie_user')->where('updated_at', '>=', now()->subDays($days))
            ->selectRaw('movie_id, count(*) as total')->groupBy('movie_id')->orderByDesc('total')->limit(6)->pluck('movie_id')->all();
        $movies = Movie::query()->published()->whereIn('id', $ids)->get()
            ->sortBy(fn (Movie $m) => array_search($m->id, $ids, true))->values();
        if ($movies->count() < 6) {
            $movies = $movies->concat(Movie::query()->published()->whereNotIn('id', $movies->pluck('id'))
                ->when($days <= 7, fn (Builder $q) => $q->where('updated_at', '>=', now()->subDays(60)))
                ->orderByDesc('views_count')->limit(6 - $movies->count())->get());
        }

        return array_values($movies->map(fn (Movie $m) => $m->toCard())->all());
    }
}
