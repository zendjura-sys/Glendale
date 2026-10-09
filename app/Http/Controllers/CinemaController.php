<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Like;
use App\Models\Movie;
use App\Models\MovieSource;
use App\Models\User;
use App\Services\Cinema\CinemaService;
use App\Services\Cinema\FlixcdnPlayer;
use App\Services\FriendshipService;
use App\Services\PostPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CinemaController extends Controller
{
    public const PER_PAGE = 24;

    public const PREVIEW_COMMENTS = 20;

    public const SORTS = ['new', 'popular', 'rating', 'year'];

    public function __construct(
        private readonly CinemaService $cinema,
        private readonly PostPresenter $presenter,
        private readonly FriendshipService $friendships,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $filters = $request->validate([
            'type' => ['nullable', Rule::in(array_keys(Movie::TYPES))],
            'genre' => ['nullable', 'string', 'max:60'],
            'year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
            'sort' => ['nullable', Rule::in(self::SORTS)],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $sort = $filters['sort'] ?? 'new';
        $filtered = filled($filters['type'] ?? null) || filled($filters['genre'] ?? null) || filled($filters['year'] ?? null) || filled($filters['q'] ?? null);

        $catalog = Movie::query()->published()
            ->search($filters['q'] ?? null)
            ->when($filters['type'] ?? null, fn (Builder $q, string $type) => $q->where('type', $type))
            ->when($filters['year'] ?? null, fn (Builder $q, int $year) => $q->where('year', $year))
            ->when($filters['genre'] ?? null, fn (Builder $q, string $genre) => $q->whereJsonContains('genres', $genre));

        match ($sort) {
            'popular' => $catalog->orderByDesc('views_count'),
            'rating' => $catalog->orderByRaw('coalesce(rating_imdb, rating_tmdb, rating_shikimori, 0) desc'),
            'year' => $catalog->orderByDesc('year'),
            default => $catalog->orderByDesc('created_at'),
        };
        $page = $catalog->orderByDesc('id')->paginate(self::PER_PAGE)->withQueryString();
        $page->setCollection($page->getCollection()->map(fn (Movie $m) => $m->toCard()));

        return Inertia::render('cinema/index', [
            'filters' => [
                'type' => $filters['type'] ?? null,
                'genre' => $filters['genre'] ?? null,
                'year' => $filters['year'] ?? null,
                'sort' => $sort,
                'q' => $filters['q'] ?? '',
            ],
            'filtered' => $filtered,
            'movies' => Inertia::scroll(fn () => $page),
            'total' => $page->total(),
            'featured' => $filtered ? [] : $this->featured(),
            'rows' => $filtered ? [] : [
                ['key' => 'continue', 'title' => 'Продовжити перегляд', 'movies' => $this->cards($this->listQuery($user, 'watching')->limit(12)->get())],
                ['key' => 'popular', 'title' => 'Популярне зараз', 'movies' => $this->cards(Movie::query()->published()->orderByDesc('views_count')->orderByDesc('id')->limit(16)->get())],
                ['key' => 'top', 'title' => 'Найвищий рейтинг', 'movies' => $this->cards(Movie::query()->published()->orderByRaw('coalesce(rating_imdb, rating_tmdb, rating_shikimori, 0) desc')->limit(16)->get())],
            ],
            'types' => collect(Movie::TYPES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values(),
            'typeCounts' => Movie::query()->published()->selectRaw('type, count(*) as aggregate')->groupBy('type')->pluck('aggregate', 'type')->map(fn ($v) => (int) $v),
            'genres' => $this->genres(),
            'years' => Movie::query()->published()->whereNotNull('year')->distinct()->orderByDesc('year')->limit(60)->pluck('year')->map(fn ($y) => (int) $y)->values(),
            'myCounts' => $this->myCounts($user),
        ]);
    }

    public function show(Request $request, Movie $movie): Response
    {
        $viewer = $request->user();
        abort_unless($movie->is_published || $viewer->isStaff(), 404);

        $this->cinema->recordView($movie, $request);
        $movie->load('sources');

        $comments = $movie->comments()->with('user')->latest('id')->limit(self::PREVIEW_COMMENTS)->get()->reverse()->values();
        $liked = $this->likedComments($viewer, $comments);

        $genres = $movie->genres ?? [];
        $similar = Movie::query()->published()
            ->whereKeyNot($movie->id)
            ->where('type', $movie->type)
            ->when($genres !== [], fn (Builder $q) => $q->where(function (Builder $q) use ($genres) {
                foreach (array_slice($genres, 0, 3) as $genre) {
                    $q->orWhereJsonContains('genres', $genre);
                }
            }))
            ->orderByDesc('views_count')
            ->limit(12)
            ->get();

        return Inertia::render('cinema/show', [
            'movie' => [
                ...$movie->toCard(),
                'genres' => $genres,
                'description' => $movie->description,
                'countries' => $movie->countries ?? [],
                'duration' => $movie->duration,
                'ratings' => array_filter([
                    'imdb' => $movie->rating_imdb,
                    'shikimori' => $movie->rating_shikimori,
                    'tmdb' => $movie->rating_tmdb,
                ], fn ($v) => $v !== null),
                'tagline' => $movie->tagline,
                'trailer_url' => $movie->trailer_url,
                'user_rating' => $movie->userRating(),
                'ratings_count' => $movie->ratings_count,
                'watchers_count' => $movie->watchers_count,
                'views_count' => $movie->views_count + 1,
                'comments_count' => $movie->comments_count,
                'comments_enabled' => $movie->comments_enabled,
                'is_published' => $movie->is_published,
                'imdb_id' => $movie->imdb_id,
                'shikimori_id' => $movie->shikimori_id,
                'tmdb_id' => $movie->tmdb_id,
            ],
            'players' => $this->cinema->players($movie),
            'state' => $this->cinema->stateFor($movie, $viewer),
            'statuses' => $this->statusOptions(),
            'friends' => $this->friendsWatching($viewer, $movie),
            'similar' => $this->cards($similar),
            'comments' => $comments->map(fn (Comment $c) => $this->presenter->comment($c, $viewer, $liked->has($c->id)))->values(),
            'can' => ['manage' => $viewer->isStaff()],
        ]);
    }

    public function my(Request $request): Response
    {
        $user = $request->user();
        $data = $request->validate(['status' => ['nullable', Rule::in(['all', 'rated', ...array_keys(Movie::STATUSES)])]]);
        $status = $data['status'] ?? 'all';

        $page = $this->listQuery($user, $status)->paginate(self::PER_PAGE)->withQueryString();
        $page->setCollection($page->getCollection()->map(fn (Movie $m) => [
            ...$m->toCard(),
            'my_status' => $m->getAttribute('my_status'),
            'my_rating' => $m->getAttribute('my_rating') !== null ? (int) $m->getAttribute('my_rating') : null,
        ]));

        return Inertia::render('cinema/my', [
            'status' => $status,
            'movies' => Inertia::scroll(fn () => $page),
            'statuses' => $this->statusOptions(),
            'counts' => $this->myCounts($user),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate(['q' => ['nullable', 'string', 'max:100']]);

        $movies = Movie::query()->published()
            ->search($data['q'] ?? null)
            ->orderByDesc('views_count')
            ->limit(20)
            ->get();

        return response()->json(['movies' => $this->cards($movies)]);
    }

    public function status(Request $request, Movie $movie): JsonResponse
    {
        abort_unless($movie->is_published, 404);
        $data = $request->validate(['status' => ['nullable', Rule::in(array_keys(Movie::STATUSES))]]);

        $this->cinema->setStatus($request->user(), $movie, $data['status'] ?? null);

        return $this->stateResponse($request->user(), $movie);
    }

    public function rate(Request $request, Movie $movie): JsonResponse
    {
        abort_unless($movie->is_published, 404);
        $data = $request->validate(['rating' => ['nullable', 'integer', 'between:1,10']]);

        $this->cinema->rate($request->user(), $movie, $data['rating'] ?? null);

        return $this->stateResponse($request->user(), $movie);
    }

    public function started(Request $request, Movie $movie): JsonResponse
    {
        abort_unless($movie->is_published, 404);
        $this->cinema->started($request->user(), $movie);

        return $this->stateResponse($request->user(), $movie);
    }

    public function comments(Request $request, Movie $movie): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($movie->is_published || $viewer->isStaff(), 404);

        $comments = $movie->comments()->with('user')->orderBy('id')->limit(500)->get();
        $liked = $this->likedComments($viewer, $comments);

        return response()->json([
            'comments' => $comments->map(fn (Comment $c) => $this->presenter->comment($c, $viewer, $liked->has($c->id)))->values(),
        ]);
    }

    public function comment(Request $request, Movie $movie): JsonResponse
    {
        $user = $request->user();
        abort_unless($movie->is_published, 404);
        abort_unless($movie->comments_enabled, 403, 'Коментарі до цього фільму вимкнено.');

        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
            'parent_id' => ['nullable', 'integer'],
        ]);

        $comment = DB::transaction(function () use ($movie, $user, $data) {
            $comment = $movie->comments()->create([
                'user_id' => $user->id,
                'parent_id' => isset($data['parent_id']) ? $movie->comments()->whereKey($data['parent_id'])->value('id') : null,
                'body' => trim($data['body']),
            ]);
            $movie->increment('comments_count');

            return $comment;
        });

        return response()->json([
            'comment' => $this->presenter->comment($comment->load('user'), $user),
            'comments_count' => $movie->fresh()->comments_count,
        ], 201);
    }

    /**
     * Фільми користувача зі статусом/оцінкою; `my_status` і `my_rating` — з pivot.
     *
     * @return Builder<Movie>
     */
    private function listQuery(User $user, string $status): Builder
    {
        return Movie::query()->published()
            ->join('movie_user', 'movie_user.movie_id', '=', 'movies.id')
            ->where('movie_user.user_id', $user->id)
            ->when($status === 'rated', fn (Builder $q) => $q->whereNotNull('movie_user.rating'))
            ->when(! in_array($status, ['all', 'rated'], true), fn (Builder $q) => $q->where('movie_user.status', $status))
            ->select('movies.*', 'movie_user.status as my_status', 'movie_user.rating as my_rating')
            ->orderByDesc('movie_user.updated_at')
            ->orderByDesc('movies.id');
    }

    /**
     * @return array<string, int>
     */
    private function myCounts(User $user): array
    {
        $rows = DB::table('movie_user')
            ->join('movies', 'movies.id', '=', 'movie_user.movie_id')
            ->where('movie_user.user_id', $user->id)
            ->where('movies.is_published', true)
            ->whereNull('movies.deleted_at')
            ->get(['movie_user.status', 'movie_user.rating']);

        $counts = ['all' => $rows->count(), 'rated' => $rows->whereNotNull('rating')->count()];
        foreach (array_keys(Movie::STATUSES) as $key) {
            $counts[$key] = $rows->where('status', $key)->count();
        }

        return $counts;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function featured(): array
    {
        $movies = Movie::query()->published()->where('is_featured', true)->latest('updated_at')->limit(6)->get();
        if ($movies->isEmpty()) {
            $movies = Movie::query()->published()->whereNotNull('description')->orderByDesc('views_count')->limit(5)->get();
        }

        return array_values($movies->map(fn (Movie $m) => [
            ...$m->toCard(),
            'description' => $m->description,
            'duration' => $m->duration,
            'genres' => array_slice($m->genres ?? [], 0, 4),
        ])->all());
    }

    /**
     * @return list<array{name: string, count: int}>
     */
    private function genres(): array
    {
        return Cache::remember('cinema.genres', now()->addMinutes(10), fn () => array_values(Movie::query()->published()
            ->whereNotNull('genres')
            ->pluck('genres')
            ->flatten()
            ->countBy()
            ->sortDesc()
            ->take(30)
            ->map(fn (int $count, string $name) => ['name' => $name, 'count' => $count])
            ->all()));
    }

    /**
     * @return list<array{key: string, label: string}>
     */
    private function statusOptions(): array
    {
        return array_values(collect(Movie::STATUSES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->all());
    }

    /**
     * @return array{users: list<array<string, mixed>>, total: int}
     */
    private function friendsWatching(User $viewer, Movie $movie): array
    {
        $ids = $this->friendships->friendIds($viewer);
        if ($ids === []) {
            return ['users' => [], 'total' => 0];
        }

        $query = DB::table('movie_user')->where('movie_id', $movie->id)->whereIn('user_id', $ids)->whereNotNull('status');
        $rows = (clone $query)->orderByDesc('updated_at')->limit(8)->get(['user_id', 'status', 'rating']);
        $users = User::query()->whereIn('id', $rows->pluck('user_id'))->get()->keyBy('id');

        return [
            'users' => array_values($rows->filter(fn ($r) => $users->has($r->user_id))->map(fn ($r) => [
                ...$users[$r->user_id]->toCard(),
                'movie_status' => $r->status,
                'movie_rating' => $r->rating !== null ? (int) $r->rating : null,
            ])->all()),
            'total' => $query->count(),
        ];
    }

    /**
     * @param  Collection<int, Movie>  $movies
     * @return list<array<string, mixed>>
     */
    private function cards(Collection $movies): array
    {
        return array_values($movies->map(fn (Movie $m) => $m->toCard())->all());
    }

    /**
     * @param  Collection<int, Comment>  $comments
     * @return \Illuminate\Support\Collection<int, int>
     */
    private function likedComments(User $viewer, Collection $comments): \Illuminate\Support\Collection
    {
        return Like::query()
            ->where('user_id', $viewer->id)
            ->where('likeable_type', (new Comment)->getMorphClass())
            ->whereIn('likeable_id', $comments->modelKeys())
            ->pluck('likeable_id')
            ->flip();
    }

    /**
     * Порожня сторінка з iframe: WebView застосунку відкриває її з gamecon.online,
     * тож Kodik бачить дозволений домен, а не порожній referrer.
     */
    public function embed(Request $request, FlixcdnPlayer $flixcdn): \Symfony\Component\HttpFoundation\Response
    {
        $url = (string) $request->query('src', '');
        abort_unless($this->embeddable($url, $flixcdn), 404);

        $src = e($url);
        $html = <<<HTML
        <!DOCTYPE html>
        <html><head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="referrer" content="origin">
        <style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#000}</style>
        </head>
        <body><iframe src="{$src}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="origin"></iframe>
        <script>
        // Міст для спільного перегляду в застосунку: події плеєра — у Flutter, команди — у плеєр.
        window.addEventListener('message', function (e) {
            if (window.GcBridge && e.source === document.querySelector('iframe').contentWindow) {
                try { GcBridge.postMessage(JSON.stringify(e.data)); } catch (_) {}
            }
        });
        window.gcSend = function (msg) { document.querySelector('iframe').contentWindow.postMessage(msg, '*'); };
        </script></body>
        </html>
        HTML;

        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    private function embeddable(string $url, FlixcdnPlayer $flixcdn): bool
    {
        $parts = parse_url($url);
        if (! is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || ! isset($parts['host'])) {
            return false;
        }

        if (MovieSource::query()->where('link', $url)->exists()) {
            return true;
        }

        $host = strtolower((string) $parts['host']);
        foreach (['kodik.info', 'kodik.cc', 'kodik.biz', 'kodikplayer.com', 'youtube.com', 'youtube-nocookie.com', 'youtu.be'] as $suffix) {
            if ($host === $suffix || str_ends_with($host, '.'.$suffix)) {
                return true;
            }
        }

        $templateHost = parse_url((string) $flixcdn->template(), PHP_URL_HOST);

        return is_string($templateHost) && strcasecmp($templateHost, $host) === 0;
    }

    private function stateResponse(User $user, Movie $movie): JsonResponse
    {
        $movie->refresh();

        return response()->json([
            'state' => $this->cinema->stateFor($movie, $user),
            'user_rating' => $movie->userRating(),
            'ratings_count' => $movie->ratings_count,
            'watchers_count' => $movie->watchers_count,
        ]);
    }
}
