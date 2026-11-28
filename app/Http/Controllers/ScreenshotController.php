<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\Photo;
use App\Models\PhotoAlbum;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Галерея скриншотів за іграми: фото з публічних альбомів, позначені грою
 * (гра альбому чи окремого фото). Фільтр за грою, сортування «нові» / «популярні».
 */
class ScreenshotController extends Controller
{
    private const PER_PAGE = 36;

    public function index(Request $request): Response
    {
        $sort = $request->query('sort') === 'top' ? 'top' : 'new';
        $page = max(1, (int) $request->query('page', 1));
        $game = $request->filled('game') ? Game::query()->where('slug', (string) $request->query('game'))->first() : null;

        $query = $this->base()
            ->when($game, fn (Builder $q, Game $g) => $q->where('photos.game_id', $g->id))
            ->when($sort === 'top', fn (Builder $q) => $q->orderByDesc('photos.likes_count')->orderByDesc('photos.views_count'))
            ->orderByDesc('photos.id');
        $items = $query->with(['user', 'game:id,slug,name'])->forPage($page, self::PER_PAGE + 1)->get();
        $more = $items->count() > self::PER_PAGE;

        return Inertia::render('screenshots/index', [
            'photos' => $items->take(self::PER_PAGE)->map(fn (Photo $p) => [
                ...$p->toThumb(),
                'user' => $p->user?->toCard(),
                'game' => $p->game ? ['slug' => $p->game->slug, 'name' => $p->game->name] : null,
            ])->values(),
            'more' => $more,
            'filters' => ['game' => $game?->slug, 'sort' => $sort, 'page' => $page],
            'game' => $game ? ['slug' => $game->slug, 'name' => $game->name, 'cover' => $game->cover] : null,
            // Ігри зі скриншотами — для перемикача (кеш на 10 хв).
            'games' => Cache::remember('screenshots.games', 600, fn () => DB::table('photos')
                ->join('photo_albums', 'photo_albums.id', '=', 'photos.album_id')
                ->join('games', 'games.id', '=', 'photos.game_id')
                ->where('photo_albums.privacy', PhotoAlbum::PRIVACY_PUBLIC)
                ->where('photos.is_sensitive', false)
                ->groupBy('games.id', 'games.slug', 'games.name')
                ->orderByDesc(DB::raw('count(*)'))->limit(30)
                ->get(['games.slug', 'games.name', DB::raw('count(*) as total')])
                ->map(fn ($r) => ['slug' => $r->slug, 'name' => $r->name, 'total' => (int) $r->total])->all()),
        ]);
    }

    /** Скільки публічних скриншотів у гри (для сторінки гри). */
    public static function countFor(Game $game): int
    {
        return Cache::remember("screenshots.count.{$game->id}", 600, fn () => (new self)->base()->where('photos.game_id', $game->id)->count());
    }

    /** @return Builder<Photo> */
    private function base(): Builder
    {
        return Photo::query()->select('photos.*')
            ->join('photo_albums', 'photo_albums.id', '=', 'photos.album_id')
            ->whereNotNull('photos.game_id')
            ->where('photo_albums.privacy', PhotoAlbum::PRIVACY_PUBLIC)
            ->where('photos.is_sensitive', false);
    }
}
