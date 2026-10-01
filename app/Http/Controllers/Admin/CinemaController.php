<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Movie;
use App\Models\MovieSource;
use App\Services\Cinema\CinemaException;
use App\Services\Cinema\CinemaService;
use App\Services\Cinema\FlixcdnPlayer;
use App\Services\Cinema\KodikClient;
use App\Services\ImageStorage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CinemaController extends Controller
{
    public const FILTERS = ['all', 'published', 'hidden', 'featured', 'no_sources', 'trashed'];

    public function __construct(
        private readonly CinemaService $cinema,
        private readonly KodikClient $kodik,
        private readonly FlixcdnPlayer $flixcdn,
        private readonly ImageStorage $images,
    ) {}

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', Rule::in(array_keys(Movie::TYPES))],
            'filter' => ['nullable', Rule::in(self::FILTERS)],
        ]);
        $filter = $filters['filter'] ?? 'all';

        $movies = Movie::query()
            ->withCount('sources')
            ->search($filters['q'] ?? null)
            ->when($filters['type'] ?? null, fn (Builder $q, string $type) => $q->where('type', $type))
            ->tap(fn (Builder $q) => match ($filter) {
                'published' => $q->where('is_published', true),
                'hidden' => $q->where('is_published', false),
                'featured' => $q->where('is_featured', true),
                'no_sources' => $q->doesntHave('sources'),
                'trashed' => $q->onlyTrashed(),
                default => $q,
            })
            ->latest('id')
            ->paginate(30)
            ->withQueryString()
            ->through(fn (Movie $m) => [
                ...$m->toCard(),
                'is_published' => $m->is_published,
                'is_featured' => $m->is_featured,
                'sources_count' => $m->sources_count,
                'views_count' => $m->views_count,
                'watchers_count' => $m->watchers_count,
                'comments_count' => $m->comments_count,
                'kinopoisk_id' => $m->kinopoisk_id,
                'imdb_id' => $m->imdb_id,
                'shikimori_id' => $m->shikimori_id,
                'created_at' => $m->created_at->toIso8601String(),
                'deleted_at' => $m->deleted_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/cinema', [
            'movies' => $movies,
            'filters' => ['q' => $filters['q'] ?? '', 'type' => $filters['type'] ?? null, 'filter' => $filter],
            'types' => $this->typeOptions(),
            'stats' => [
                'movies' => Movie::query()->count(),
                'published' => Movie::query()->where('is_published', true)->count(),
                'featured' => Movie::query()->where('is_featured', true)->count(),
                'sources' => MovieSource::query()->count(),
                'views' => (int) Movie::query()->sum('views_count'),
                'watchers' => DB::table('movie_user')->whereNotNull('status')->count(),
                'trashed' => Movie::onlyTrashed()->count(),
            ],
            'providers' => $this->providers(),
        ]);
    }

    public function create(): Response
    {
        return $this->editor(null);
    }

    public function store(Request $request): RedirectResponse
    {
        $movie = new Movie(['user_id' => $request->user()->id]);
        $this->save($request, $movie);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Фільм додано. Тепер додайте плеєри.']);

        return to_route('admin.cinema.edit', $movie->id);
    }

    public function edit(int $movie): Response
    {
        return $this->editor(Movie::withTrashed()->with('sources')->findOrFail($movie));
    }

    public function update(Request $request, int $movie): RedirectResponse
    {
        $this->save($request, Movie::withTrashed()->findOrFail($movie));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Зміни збережено.']);

        return back();
    }

    public function flags(Request $request, int $movie): RedirectResponse
    {
        $data = $request->validate([
            'is_published' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'comments_enabled' => ['sometimes', 'boolean'],
        ]);

        Movie::withTrashed()->findOrFail($movie)->update($data);
        Cache::forget('cinema.genres');

        return back();
    }

    public function destroy(int $movie): RedirectResponse
    {
        $model = Movie::withTrashed()->findOrFail($movie);

        if ($model->trashed()) {
            $this->images->delete($model->poster_path);
            $this->images->delete($model->backdrop_path);
            $model->forceDelete();
            $message = 'Фільм видалено назавжди.';
        } else {
            $model->delete();
            $message = 'Фільм переміщено в кошик.';
        }
        Cache::forget('cinema.genres');

        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    public function restore(int $movie): RedirectResponse
    {
        Movie::onlyTrashed()->findOrFail($movie)->restore();
        Cache::forget('cinema.genres');
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Фільм відновлено.']);

        return back();
    }

    public function storeSource(Request $request, int $movie): RedirectResponse
    {
        $model = Movie::withTrashed()->findOrFail($movie);
        $data = $request->validate([
            'link' => ['required', 'string', 'max:500', 'url:https'],
            'translation' => ['nullable', 'string', 'max:150'],
            'quality' => ['nullable', 'string', 'max:40'],
        ], ['link.url' => 'Вкажіть адресу плеєра, що починається з https://']);

        $model->sources()->create([
            'provider' => 'custom',
            'external_id' => (string) Str::uuid(),
            'link' => $this->embedLink($data['link']),
            'translation' => $data['translation'] ?? null,
            'quality' => $data['quality'] ?? null,
            'position' => (int) $model->sources()->getQuery()->max('position') + 1,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Плеєр додано.']);

        return back();
    }

    public function destroySource(int $movie, MovieSource $source): RedirectResponse
    {
        abort_unless($source->movie_id === $movie, 404);
        $source->delete();

        return back();
    }

    public function refresh(int $movie): RedirectResponse
    {
        $count = $this->cinema->refreshKodik(Movie::withTrashed()->findOrFail($movie));
        Inertia::flash('toast', ['type' => 'success', 'message' => "Kodik: оновлено озвучок — {$count}."]);

        return back();
    }

    public function import(): Response
    {
        return Inertia::render('admin/cinema-import', [
            'configured' => $this->kodik->configured(),
            'types' => $this->typeOptions(),
        ]);
    }

    public function kodikSearch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'max:150'],
            'by' => ['nullable', Rule::in(['title', 'kinopoisk_id', 'imdb_id', 'shikimori_id'])],
        ]);

        return $this->candidatesResponse($this->kodik->search([($data['by'] ?? 'title') => trim($data['q'])]));
    }

    public function kodikLatest(Request $request): JsonResponse
    {
        $data = $request->validate(['types' => ['nullable', 'string', 'max:200']]);

        return $this->candidatesResponse($this->kodik->latest($data['types'] ?? null, 60));
    }

    public function kodikImport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'key' => ['required', 'string', 'max:200'],
            'q' => ['nullable', 'string', 'max:150'],
            'type' => ['nullable', Rule::in(array_keys(Movie::TYPES))],
            'publish' => ['sometimes', 'boolean'],
        ]);

        [$kind, $value] = array_pad(explode(':', $data['key'], 2), 2, '');
        $criteria = match ($kind) {
            'kp' => ['kinopoisk_id' => $value],
            'shiki' => ['shikimori_id' => $value],
            'imdb' => ['imdb_id' => $value],
            default => ['title' => (string) ($data['q'] ?? '')],
        };

        $candidate = collect($this->kodik->search($criteria))->firstWhere('key', $data['key']);
        if (! $candidate) {
            throw new CinemaException('Kodik більше не віддає цей матеріал. Оновіть пошук.', 404);
        }
        if (isset($data['type'])) {
            $candidate['type'] = $data['type'];
        }

        $movie = $this->cinema->import($candidate, $request->user());
        if ($request->has('publish')) {
            $movie->update(['is_published' => $request->boolean('publish')]);
        }
        Cache::forget('cinema.genres');

        return response()->json([
            'movie' => [...$movie->toCard(), 'admin_href' => '/admin/cinema/'.$movie->id.'/edit'],
            'sources' => $movie->sources()->count(),
            'message' => "«{$movie->title}» імпортовано: озвучок — ".count($candidate['sources']).'.',
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $candidates
     */
    private function candidatesResponse(array $candidates): JsonResponse
    {
        $existing = [];
        foreach (['kinopoisk_id', 'shikimori_id', 'imdb_id'] as $field) {
            $values = collect($candidates)->pluck($field)->filter()->unique()->values();
            if ($values->isNotEmpty()) {
                Movie::withTrashed()->whereIn($field, $values)->get(['id', $field, 'slug', 'title'])
                    ->each(function (Movie $m) use (&$existing, $field) {
                        $existing[$field.':'.$m->getAttribute($field)] = ['id' => $m->id, 'slug' => $m->slug];
                    });
            }
        }

        return response()->json([
            'candidates' => collect($candidates)->map(function (array $c) use ($existing) {
                $match = null;
                foreach (['kinopoisk_id', 'shikimori_id', 'imdb_id'] as $field) {
                    $match ??= filled($c[$field]) ? $existing[$field.':'.$c[$field]] ?? null : null;
                }

                return [
                    ...collect($c)->except('sources')->all(),
                    'type_label' => Movie::TYPES[$c['type']] ?? $c['type'],
                    'translations' => collect($c['sources'])->pluck('translation')->filter()->unique()->values()->all(),
                    'sources_count' => count($c['sources']),
                    'quality' => collect($c['sources'])->pluck('quality')->filter()->first(),
                    'imported' => $match,
                ];
            })->values(),
        ]);
    }

    private function editor(?Movie $movie): Response
    {
        return Inertia::render('admin/cinema-edit', [
            'movie' => $movie ? [
                ...$movie->toCard(),
                ...$movie->only([
                    'description', 'poster_url', 'backdrop_url', 'countries', 'duration', 'age_rating', 'rating_kp', 'rating_imdb', 'rating_shikimori',
                    'kinopoisk_id', 'imdb_id', 'shikimori_id', 'is_published', 'is_featured', 'comments_enabled', 'views_count', 'watchers_count',
                    'comments_count', 'ratings_count',
                ]),
                'genres' => $movie->genres ?? [],
                'countries' => $movie->countries ?? [],
                'has_poster_file' => $movie->poster_path !== null,
                'has_backdrop_file' => $movie->backdrop_path !== null,
                'user_rating' => $movie->userRating(),
                'deleted_at' => $movie->deleted_at?->toIso8601String(),
                'sources' => $movie->sources->map(fn (MovieSource $s) => $s->toPlayer())->values(),
                'flixcdn_link' => $this->flixcdn->link($movie),
            ] : null,
            'types' => $this->typeOptions(),
            'providers' => $this->providers(),
        ]);
    }

    private function save(Request $request, Movie $movie): void
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'title_original' => ['nullable', 'string', 'max:200'],
            'type' => ['required', Rule::in(array_keys(Movie::TYPES))],
            'year' => ['nullable', 'integer', 'min:1888', 'max:2100'],
            'description' => ['nullable', 'string', 'max:5000'],
            'genres' => ['nullable', 'array', 'max:12'],
            'genres.*' => ['string', 'max:40'],
            'countries' => ['nullable', 'array', 'max:8'],
            'countries.*' => ['string', 'max:60'],
            'duration' => ['nullable', 'integer', 'min:1', 'max:1500'],
            'age_rating' => ['nullable', 'string', 'max:10'],
            'rating_kp' => ['nullable', 'numeric', 'between:0,10'],
            'rating_imdb' => ['nullable', 'numeric', 'between:0,10'],
            'rating_shikimori' => ['nullable', 'numeric', 'between:0,10'],
            'kinopoisk_id' => ['nullable', 'string', 'max:20', 'regex:/^\d+$/'],
            'imdb_id' => ['nullable', 'string', 'max:20', 'regex:/^tt\d+$/'],
            'shikimori_id' => ['nullable', 'string', 'max:20', 'regex:/^\d+$/'],
            'poster_url' => ['nullable', 'url:http,https', 'max:500'],
            'backdrop_url' => ['nullable', 'url:http,https', 'max:500'],
            'poster' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
            'backdrop' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:12288'],
            'remove_poster' => ['sometimes', 'boolean'],
            'remove_backdrop' => ['sometimes', 'boolean'],
            'is_published' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'comments_enabled' => ['sometimes', 'boolean'],
        ], [
            'imdb_id.regex' => 'IMDb ID має вигляд tt0111161.',
            'kinopoisk_id.regex' => 'ID КіноПошуку — лише цифри.',
            'shikimori_id.regex' => 'ID Shikimori — лише цифри.',
        ]);

        $clean = fn (?array $list) => array_values(array_unique(array_filter(array_map(fn ($v) => trim((string) $v), $list ?? []))));

        $movie->fill([
            ...collect($data)->except(['poster', 'backdrop', 'remove_poster', 'remove_backdrop', 'genres', 'countries'])->all(),
            'genres' => $clean($data['genres'] ?? null) ?: null,
            'countries' => $clean($data['countries'] ?? null) ?: null,
        ]);
        $movie->slug ??= $this->cinema->uniqueSlug($movie->title, $movie->year);

        foreach (['poster' => 1000, 'backdrop' => 2400] as $field => $side) {
            $column = $field.'_path';
            if ($request->hasFile($field)) {
                $this->images->delete($movie->getAttribute($column));
                $movie->setAttribute($column, $this->images->store($request->file($field), 'cinema', $side)['path']);
            } elseif ($request->boolean('remove_'.$field)) {
                $this->images->delete($movie->getAttribute($column));
                $movie->setAttribute($column, null);
            }
        }

        $movie->save();
        Cache::forget('cinema.genres');
    }

    /**
     * YouTube/Vimeo-посилання перетворюються на embed-адреси, інші лишаються як є.
     */
    private function embedLink(string $url): string
    {
        if (preg_match('~(?:youtube\.com/watch\?(?:.*&)?v=|youtu\.be/|youtube\.com/embed/)([A-Za-z0-9_-]{11})~', $url, $m)) {
            return 'https://www.youtube-nocookie.com/embed/'.$m[1];
        }
        if (preg_match('~vimeo\.com/(?:video/)?(\d+)~', $url, $m)) {
            return 'https://player.vimeo.com/video/'.$m[1];
        }

        return $url;
    }

    /**
     * @return list<array{key: string, label: string}>
     */
    private function typeOptions(): array
    {
        return collect(Movie::TYPES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values()->all();
    }

    /**
     * @return array{kodik: bool, flixcdn: bool}
     */
    private function providers(): array
    {
        return ['kodik' => $this->kodik->configured(), 'flixcdn' => $this->flixcdn->configured()];
    }
}
