<?php

namespace App\Http\Controllers;

use App\Models\Clan;
use App\Models\Game;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Каталог мультиплеєрних ігор: пошук, розділи ПК / мобільні / консолі, покажчик A–Z.
 */
class GameController extends Controller
{
    public function index(Request $request): Response|JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'category' => ['nullable', Rule::in(array_keys(Game::CATEGORIES))],
            'platform' => ['nullable', Rule::in(array_keys(Game::PLATFORMS))],
            'letter' => ['nullable', 'string', 'regex:/^([A-Z]|#)$/'],
        ]);

        $games = $this->query($filters)
            ->orderByDesc('popularity')
            ->orderBy('name')
            ->paginate(36)
            ->withQueryString()
            ->through(fn (Game $g) => $g->toCard());

        $letters = Game::query()->published()
            ->when($filters['category'] ?? null, fn (Builder $q, string $c) => $q->where('category', $c))
            ->distinct()->orderBy('letter')->pluck('letter')->values();

        $props = [
            'games' => $games,
            'filters' => [
                'q' => $filters['q'] ?? '',
                'category' => $filters['category'] ?? null,
                'platform' => $filters['platform'] ?? null,
                'letter' => $filters['letter'] ?? null,
            ],
            'categories' => Game::CATEGORIES,
            'platforms' => Game::PLATFORMS,
            'letters' => $letters,
            'total' => Game::query()->published()->count(),
        ];

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json($props)
            : Inertia::render('games/index', $props);
    }

    public function show(Request $request, Game $game): Response|JsonResponse
    {
        abort_unless($game->is_published || $request->user()?->isStaff(), 404);

        $props = [
            'game' => [
                ...$game->toCard(),
                'genres' => $game->genres ?? [],
                'released' => $game->released?->toDateString(),
                'rating' => $game->rating,
                'links' => $game->storeLinks(),
            ],
            'clans' => Clan::query()->where('game_id', $game->id)->orderByDesc('members_count')->limit(30)->get()
                ->map(fn (Clan $c) => $c->toCard())->values(),
        ];

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json($props)
            : Inertia::render('games/show', $props);
    }

    /** Швидкий пошук для вибору гри (створення клану тощо). */
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        return response()->json([
            'games' => $this->query(['q' => $q])
                ->orderByDesc('popularity')
                ->limit(12)
                ->get()
                ->map(fn (Game $g) => $g->toCard())
                ->values(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Game>
     */
    private function query(array $filters): Builder
    {
        $q = trim((string) ($filters['q'] ?? ''));

        return Game::query()->published()
            ->when($q !== '', fn (Builder $query) => $query->where(fn (Builder $w) => $w
                ->where('name', 'like', '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%')
                ->orWhere('slug', 'like', '%'.str_replace(['%', '_', ' '], ['\%', '\_', '-'], mb_strtolower($q)).'%')))
            ->when($filters['category'] ?? null, fn (Builder $query, string $c) => $query->where('category', $c))
            ->when($filters['platform'] ?? null, fn (Builder $query, string $p) => $query->whereJsonContains('platforms', $p))
            ->when($filters['letter'] ?? null, fn (Builder $query, string $l) => $query->where('letter', $l));
    }
}
