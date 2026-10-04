<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Clan;
use App\Models\Game;
use App\Services\Games\GameCatalog;
use App\Support\Settings\SiteSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Каталог ігор в адмінці: увімкнення можливостей каталогу й картки гри, ручне оновлення,
 * приховування окремих ігор.
 */
class GameController extends Controller
{
    public function __construct(
        private readonly SiteSettings $settings,
        private readonly GameCatalog $catalog,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'status' => ['nullable', Rule::in(['published', 'hidden'])],
            'category' => ['nullable', Rule::in(array_keys(Game::CATEGORIES))],
        ]);

        $games = Game::query()
            ->when($filters['q'] ?? null, fn (Builder $q, string $t) => $q->where('name', 'like', '%'.str_replace(['%', '_'], ['\%', '\_'], $t).'%'))
            ->when(($filters['status'] ?? null) === 'hidden', fn (Builder $q) => $q->where('is_published', false))
            ->when(($filters['status'] ?? null) === 'published', fn (Builder $q) => $q->where('is_published', true))
            ->when($filters['category'] ?? null, fn (Builder $q, string $c) => $q->where('category', $c))
            ->orderByDesc('popularity')
            ->orderBy('name')
            ->paginate(40)
            ->withQueryString()
            ->through(fn (Game $g) => [
                ...$g->toCard(),
                'is_published' => $g->is_published,
                'source' => $g->igdb_id ? 'IGDB' : ($g->rawg_id ? 'RAWG' : 'Стартовий список'),
                'clans_count' => Clan::query()->where('game_id', $g->id)->count(),
                'updated_at' => $g->updated_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/games', [
            'games' => $games,
            'filters' => ['q' => $filters['q'] ?? '', 'status' => $filters['status'] ?? null, 'category' => $filters['category'] ?? null],
            'categories' => Game::CATEGORIES,
            'features' => collect(Game::FEATURES)->map(fn (array $f, string $key) => [...$f, 'key' => $key])->values(),
            'enabled' => Game::features($this->settings->get('games_features')),
            'stats' => [
                'total' => Game::query()->count(),
                'hidden' => Game::query()->where('is_published', false)->count(),
                'igdb' => Game::query()->whereNotNull('igdb_id')->count(),
                'rawg' => Game::query()->whereNotNull('rawg_id')->count(),
                'clans' => Clan::query()->count(),
                'source' => $this->catalog->source(),
                'last_sync' => Game::query()->max('links_checked_at'),
            ],
        ]);
    }

    public function features(Request $request): RedirectResponse
    {
        $rules = [];
        foreach (array_keys(Game::FEATURES) as $key) {
            $rules[$key] = ['required', 'boolean'];
        }
        $data = $request->validate($rules);
        $this->settings->put(['games_features' => array_map(fn ($v) => (bool) $v, $data)]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Можливості каталогу збережено.']);

        return back();
    }

    /** Ручне оновлення: одна сторінка кожного розділу, щоб запит не тривав довго. Повне — щоночі. */
    public function sync(): RedirectResponse
    {
        $seeded = $this->catalog->seed();
        if (! $this->catalog->configured()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => 'Спершу додайте ключі IGDB в Інтеграціях. Зі стартового списку: +'.$seeded]);

            return back();
        }
        set_time_limit(300);
        $result = $this->catalog->sync(1);
        Cache::forget('games.genres');
        Inertia::flash('toast', ['type' => 'success', 'message' => "Джерело: {$this->catalog->source()}. Ігор оновлено: {$result['games']}, посилань: {$result['links']}."]);

        return back();
    }

    public function update(Request $request, Game $game): RedirectResponse
    {
        $data = $request->validate(['is_published' => ['required', 'boolean']]);
        $game->update(['is_published' => $data['is_published']]);
        Cache::forget('games.genres');
        Inertia::flash('toast', ['type' => 'success', 'message' => $data['is_published'] ? "«{$game->name}» знову в каталозі." : "«{$game->name}» приховано з каталогу."]);

        return back();
    }
}
