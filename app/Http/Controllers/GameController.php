<?php

namespace App\Http\Controllers;

use App\Models\Clan;
use App\Models\Game;
use App\Models\GameEvent;
use App\Models\GameGuide;
use App\Models\User;
use App\Services\EventCalendar;
use App\Services\FollowAlerts;
use App\Services\FriendshipService;
use App\Services\Games\CommunityRatings;
use App\Services\Games\PosterPalette;
use App\Services\Presence\PlayingStatus;
use App\Services\SavedItems;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Каталог мультиплеєрних ігор: пошук, розділи ПК / мобільні / консолі, покажчик A–Z.
 */
class GameController extends Controller
{
    /** Які поля картки гри належать до кожної можливості (Адмінка → Ігри). */
    private const DETAIL_FEATURES = [
        'summary' => ['summary', 'storyline'],
        'media' => ['screenshots', 'artworks', 'videos'],
        'multiplayer' => ['multiplayer'],
        'ratings' => ['ratings'],
        'about' => ['developers', 'publishers', 'engines', 'franchises', 'themes', 'perspectives', 'hypes'],
        'age_ratings' => ['age_ratings'],
        'release_dates' => ['release_dates'],
        'languages' => ['languages'],
        'time_to_beat' => ['time_to_beat'],
        'websites' => ['websites', 'igdb_url'],
    ];

    public function __construct(private readonly SiteSettings $settings) {}

    /**
     * @return array<string, bool>
     */
    private function features(): array
    {
        return Game::features($this->settings->get('games_features'));
    }

    public function index(Request $request): Response|JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'category' => ['nullable', Rule::in(array_keys(Game::CATEGORIES))],
            'platform' => ['nullable', Rule::in(array_keys(Game::PLATFORMS))],
            'letter' => ['nullable', 'string', 'regex:/^([A-Z]|#)$/'],
            'genre' => ['nullable', 'string', 'max:60'],
            'mode' => ['nullable', Rule::in(array_keys(Game::MODES))],
            'collection' => ['nullable', Rule::in(['duo', 'evening'])],
            'sort' => ['nullable', Rule::in(array_keys(Game::SORTS))],
        ]);
        $on = $this->features();
        // Вимкнені фільтри ігноруються, навіть якщо параметр прийшов у запиті.
        foreach (['genre' => 'filter_genres', 'mode' => 'filter_modes', 'sort' => 'sorting'] as $param => $feature) {
            if (! $on[$feature]) {
                $filters[$param] = null;
            }
        }
        if (! app(Plugins::class)->on('game_collections')) {
            $filters['collection'] = null;
        }
        $sort = $filters['sort'] ?? 'popular';

        $query = $this->query($filters, $on['alias_search']);
        match ($sort) {
            'rating' => $query->orderByRaw('rating is null')->orderByDesc('rating')->orderByDesc('popularity'),
            'new' => $query->whereNotNull('released')->where('released', '<=', now())->orderByDesc('released'),
            'name' => $query->orderBy('name'),
            default => $query->orderByDesc('popularity')->orderBy('name'),
        };
        $games = $query
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
                'genre' => $filters['genre'] ?? null,
                'mode' => $filters['mode'] ?? null,
                'collection' => $filters['collection'] ?? null,
                'sort' => $sort,
            ],
            'categories' => Game::CATEGORIES,
            'modes' => $on['filter_modes'] ? Game::MODES : (object) [],
            'sorts' => $on['sorting'] ? Game::SORTS : (object) [],
            'genres' => $on['filter_genres'] ? $this->genres() : [],
            'features' => $on,
            'platforms' => Game::PLATFORMS,
            'letters' => $letters,
            'total' => Game::query()->published()->count(),
        ];

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json($props)
            : Inertia::render('games/index', $props);
    }

    /**
     * Кольори з постера: з кешу одразу, інакше — відкладеним пропом після першого показу сторінки.
     */
    private function palette(?string $poster): mixed
    {
        $palettes = app(PosterPalette::class);
        $cached = $palettes->cached($poster);
        if ($cached !== null || $poster === null) {
            return $cached ?: null;
        }

        return Inertia::defer(fn () => $palettes->resolve($poster), 'palette');
    }

    public function show(Request $request, Game $game, PlayingStatus $playing, FriendshipService $friendships): Response|JsonResponse
    {
        abort_unless($game->is_published || $request->user()?->isStaff(), 404);

        $on = $this->features();
        $plugins = app(Plugins::class);
        $details = $game->details ?? [];
        foreach (self::DETAIL_FEATURES as $feature => $keys) {
            if (! $on[$feature]) {
                $details = array_diff_key($details, array_flip($keys));
            }
        }
        $similarIds = ! $on['similar'] ? [] : array_values(array_filter(array_map('intval', (array) ($details['similar'] ?? []))));
        unset($details['similar']);
        if (isset($details['release_dates'])) {
            $details['release_dates'] = array_values(array_map(fn (array $r) => [
                'platform' => Game::PLATFORMS[(string) ($r['platform'] ?? '')] ?? (string) ($r['platform'] ?? ''),
                'date' => $r['date'] ?? null,
            ], array_filter((array) $details['release_dates'], 'is_array')));
        }

        $poster = is_array($details['artworks'] ?? null) && isset($details['artworks'][0]) ? (string) $details['artworks'][0] : $game->toCard()['cover'];

        $props = [
            'palette' => $this->palette(is_string($poster) ? $poster : null),
            'game' => [
                ...$game->toCard(),
                'genres' => $game->genres ?? [],
                'modes' => array_map(fn (string $m) => ['key' => $m, 'label' => Game::MODES[$m]], $game->toCard()['modes']),
                'released' => $game->released?->toDateString(),
                'rating' => $game->rating,
                'links' => $game->storeLinks(),
                'collections' => $plugins->on('game_collections') ? array_values(array_intersect(['duo', 'evening'], $game->collections ?? [])) : [],
                'details' => (object) $details,
            ],
            'similar' => $similarIds === [] ? [] : Game::query()->published()->whereIn('igdb_id', $similarIds)
                ->orderByDesc('popularity')->limit(12)->get()->map(fn (Game $g) => $g->toCard())->values(),
            'clans' => ! $on['clans'] ? [] : Clan::query()->where('game_id', $game->id)->orderByDesc('members_count')->limit(30)->get()
                ->map(fn (Clan $c) => $c->toCard())->values(),
            'features' => $on,
            'playing_now' => $request->user() ? $playing->playingNow('game', $game->id, $friendships->friendIds($request->user())) : [],
            'playing_count' => $playing->countNow('game', $game->id),
            'events' => ($on['events'] || $on['release_events']) && app(ModuleManager::class)->enabled('events') ? app(EventCalendar::class)->forGame($game, $request->user()) : [],
            'event_types' => GameEvent::TYPES,
            'can_add_event' => $on['events'] && $request->user()?->isStaff() === true,
            'saved' => $request->user() ? app(SavedItems::class)->has($request->user(), 'game', $game->id) : false,
            'following' => $request->user() ? app(FollowAlerts::class)->has($request->user(), 'game', $game->id) : false,
            'pinned' => is_array($pin = $request->user()?->pref('pin')) && ($pin['kind'] ?? null) === 'game' && (int) ($pin['id'] ?? 0) === $game->id,
            'community_rating' => $plugins->on('game_community_rating') ? app(CommunityRatings::class)->summary($game, $request->user()) : null,
            'steam_friends' => $plugins->on('steam_friends') ? $this->steamFriends($game, $request->user(), $friendships) : [],
            'can_curate' => $plugins->on('game_collections') && $request->user()?->isStaff() === true,
            'guides' => $plugins->on('game_guides')
                ? GameGuide::query()->with('user')->where('game_id', $game->id)->latest('id')->limit(20)->get()
                    ->map(fn (GameGuide $guide) => [
                        'id' => $guide->id,
                        'title' => $guide->title,
                        'body' => $guide->body,
                        'created_at' => $guide->created_at->toIso8601String(),
                        'user' => $guide->user?->toCard(),
                        'mine' => $request->user()?->id === $guide->user_id || $request->user()?->isStaff() === true,
                    ])->values()
                : [],
        ];

        $props['moments'] = $request->user() && app(ModuleManager::class)->enabled('moments')
            ? MomentController::forGame($game, $request->user(), $request)
            : [];

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            // Застосунку — ті самі кольори постера одразу (рахуються за маленькою копією, далі з кешу).
            $props['palette'] = is_string($poster) && $poster !== '' ? app(PosterPalette::class)->resolve($poster) : null;

            return response()->json($props);
        }

        return Inertia::render('games/show', $props);
    }

    public function collections(Request $request, Game $game): RedirectResponse
    {
        app(Plugins::class)->ensure('game_collections');
        abort_unless($request->user()->isStaff(), 403);
        $data = $request->validate([
            'duo' => ['sometimes', 'boolean'],
            'evening' => ['sometimes', 'boolean'],
        ]);
        $items = [];
        if ($request->boolean('duo')) {
            $items[] = 'duo';
        }
        if ($request->boolean('evening')) {
            $items[] = 'evening';
        }
        $game->forceFill(['collections' => $items])->save();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Добірку оновлено.']);

        return back();
    }

    public function guide(Request $request, Game $game): RedirectResponse
    {
        app(Plugins::class)->ensure('game_guides');
        abort_unless($game->is_published || $request->user()->isStaff(), 404);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:80'],
            'body' => ['required', 'string', 'min:10', 'max:5000'],
        ]);
        $game->guides()->create([
            'user_id' => $request->user()->id,
            'title' => trim($data['title']),
            'body' => trim($data['body']),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Гід опубліковано.']);

        return back();
    }

    public function deleteGuide(Request $request, Game $game, GameGuide $guide): RedirectResponse
    {
        app(Plugins::class)->ensure('game_guides');
        abort_unless($guide->game_id === $game->id, 404);
        abort_unless($guide->user_id === $request->user()->id || $request->user()->isStaff(), 403);
        $guide->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Гід видалено.']);

        return back();
    }

    /** Швидкий пошук для вибору гри (створення клану тощо). */
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        return response()->json([
            'games' => $this->query(['q' => $q], $this->features()['alias_search'])
                ->orderByDesc('popularity')
                ->limit(12)
                ->get()
                ->map(fn (Game $g) => $g->toCard())
                ->values(),
        ]);
    }

    /**
     * Жанри для фільтра — найпоширеніші в каталозі (кеш на годину).
     *
     * @return list<string>
     */
    private function genres(): array
    {
        return Cache::remember('games.genres', 3600, function () {
            $counts = [];
            Game::query()->published()->whereNotNull('genres')->select('genres')->cursor()->each(function (Game $g) use (&$counts) {
                foreach ($g->genres ?? [] as $genre) {
                    $counts[$genre] = ($counts[$genre] ?? 0) + 1;
                }
            });
            arsort($counts);

            return array_map('strval', array_keys(array_slice($counts, 0, 24, true)));
        });
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function steamFriends(Game $game, ?User $viewer, FriendshipService $friendships): array
    {
        $appId = $game->steamAppId();
        if ($viewer === null || $appId === null) {
            return [];
        }
        $ids = DB::table('user_steam_apps')->where('app_id', $appId)->pluck('user_id');

        return array_values(User::query()->whereIn('id', $friendships->friendIds($viewer))->whereIn('id', $ids)->limit(12)->get()
            ->map(fn (User $friend) => $friend->toCard())->all());
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<Game>
     */
    private function query(array $filters, bool $aliases = true): Builder
    {
        $q = trim((string) ($filters['q'] ?? ''));

        return Game::query()->published()
            ->when($q !== '', fn (Builder $query) => $query->where(fn (Builder $w) => $w
                ->where('name', 'like', '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%')
                ->orWhere('slug', 'like', '%'.str_replace(['%', '_', ' '], ['\%', '\_', '-'], mb_strtolower($q)).'%')
                ->when($aliases, fn (Builder $a) => $a->orWhere('aliases', 'like', '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%'))))
            ->when($filters['genre'] ?? null, fn (Builder $query, string $g) => $query->whereJsonContains('genres', $g))
            ->when($filters['mode'] ?? null, fn (Builder $query, string $m) => $query->whereJsonContains('modes', $m))
            ->when($filters['category'] ?? null, fn (Builder $query, string $c) => $query->where('category', $c))
            ->when($filters['platform'] ?? null, fn (Builder $query, string $p) => $query->whereJsonContains('platforms', $p))
            ->when($filters['letter'] ?? null, fn (Builder $query, string $l) => $query->where('letter', $l))
            ->when($filters['collection'] ?? null, fn (Builder $query, string $collection) => $query->whereJsonContains('collections', $collection));
    }
}
