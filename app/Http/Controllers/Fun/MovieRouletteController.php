<?php

namespace App\Http\Controllers\Fun;

use App\Http\Controllers\Controller;
use App\Models\Movie;
use App\Support\Plugins\Plugins;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** «Що подивитися?» — випадковий фільм, серіал чи аніме з каталогу за фільтрами. */
class MovieRouletteController extends Controller
{
    public function index(): Response
    {
        app(Plugins::class)->ensure('movie_roulette');

        return Inertia::render('cinema/roulette', [
            'types' => Movie::TYPES,
            'genres' => Cache::remember('roulette:genres', 3600, fn () => Movie::query()->published()->pluck('genres')
                ->flatten()->filter(fn ($g) => is_string($g) && $g !== '')->countBy()->sortDesc()->keys()->take(24)->values()->all()),
        ]);
    }

    public function spin(Request $request): JsonResponse
    {
        app(Plugins::class)->ensure('movie_roulette');
        $data = $request->validate([
            'type' => ['nullable', Rule::in(array_keys(Movie::TYPES))],
            'genre' => ['nullable', 'string', 'max:40'],
            'from' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'unseen' => ['nullable', 'boolean'],
        ]);
        $viewer = $request->user();
        $movie = Movie::query()->published()
            ->when($data['type'] ?? null, fn (Builder $q, string $type) => $q->where('type', $type))
            ->when($data['from'] ?? null, fn (Builder $q, int $from) => $q->where('year', '>=', $from))
            ->when($data['genre'] ?? null, fn (Builder $q, string $genre) => $q->whereJsonContains('genres', $genre))
            ->when(($data['unseen'] ?? false) && $viewer !== null, fn (Builder $q) => $q->whereNotIn('id', DB::table('movie_user')->where('user_id', $viewer->id)->whereIn('status', ['watched', 'dropped'])->select('movie_id')))
            ->inRandomOrder()
            ->first();

        return response()->json(['movie' => $movie === null ? null : [
            ...$movie->toCard(),
            'description' => $movie->description ? Str::limit($movie->description, 280) : null,
        ]]);
    }
}
