<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\SyncCinemaCatalog;
use App\Models\Movie;
use App\Models\MovieRequest;
use App\Models\MovieSource;
use App\Services\Cinema\BulkPlayers;
use App\Services\Cinema\CinemaAutoImport;
use App\Services\Cinema\CinemaException;
use App\Services\Cinema\CinemaPlayers;
use App\Services\Cinema\CinemaService;
use App\Services\Cinema\FlixcdnClient;
use App\Services\Cinema\FlixcdnPlayer;
use App\Services\Cinema\KodikClient;
use App\Services\Cinema\Metadata\MetadataEnricher;
use App\Services\Cinema\Metadata\MetadataProvider;
use App\Services\Cinema\Metadata\TmdbProvider;
use App\Services\Cinema\TmdbAutoParse;
use App\Services\Cinema\VideoseedClient;
use App\Services\ImageStorage;
use App\Support\Settings\SiteSettings;
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
    public const FILTERS = ['all', 'published', 'hidden', 'featured', 'no_sources', 'not_enriched', 'trashed'];

    public function __construct(
        private readonly CinemaService $cinema,
        private readonly KodikClient $kodik,
        private readonly FlixcdnPlayer $flixcdn,
        private readonly FlixcdnClient $flixcdnApi,
        private readonly ImageStorage $images,
        private readonly MetadataEnricher $enricher,
        private readonly CinemaAutoImport $autoImport,
        private readonly VideoseedClient $videoseed,
        private readonly CinemaPlayers $players,
        private readonly TmdbAutoParse $tmdb,
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
                'not_enriched' => $q->whereNull('enriched_at'),
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
                'imdb_id' => $m->imdb_id,
                'shikimori_id' => $m->shikimori_id,
                'tmdb_id' => $m->tmdb_id,
                'origin' => $m->origin,
                'enriched_at' => $m->enriched_at?->toIso8601String(),
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
                'not_enriched' => Movie::query()->whereNull('enriched_at')->count(),
                'auto' => Movie::query()->where('origin', '!=', 'manual')->count(),
            ],
            'providers' => $this->providers(),
            'requests' => $this->movieRequests(),
            'auto' => [
                'config' => $this->autoImport->config(),
                'last' => $this->autoImport->lastRun(),
                'running' => ! Cache::lock('cinema.sync')->get(fn () => true),
                'kodik_types' => collect(CinemaAutoImport::KODIK_TYPES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
                'intervals' => CinemaAutoImport::INTERVALS,
            ],
            'bulk' => [
                'state' => app(BulkPlayers::class)->state(),
                'running' => app(BulkPlayers::class)->running(),
            ],
            'players' => [
                'config' => $this->players->config(),
                'providers' => $this->playerProviders(),
            ],
            'tmdb' => [
                'config' => $this->tmdb->config(),
                'configured' => app(TmdbProvider::class)->configured(),
                'language' => app(TmdbProvider::class)->language(),
                'fields' => collect(TmdbAutoParse::FIELDS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
                'lists' => collect(TmdbAutoParse::LIST_LABELS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
                'tmdb_count' => Movie::query()->whereNotNull('tmdb_id')->count(),
            ],
        ]);
    }

    /**
     * Запити глядачів на фільми, яких немає в каталозі: однакові назви разом, найчастіші вгорі.
     *
     * @return list<array{title: string, year: int|null, count: int, last_at: string, people: list<string>}>
     */
    private function movieRequests(): array
    {
        $rows = MovieRequest::query()->with('user')->latest('id')->limit(300)->get();

        return array_values($rows->groupBy(fn (MovieRequest $r) => mb_strtolower(trim($r->title)))
            ->map(fn ($group) => [
                'title' => $group->first()->title,
                'year' => $group->pluck('year')->filter()->first(),
                'count' => $group->count(),
                'last_at' => $group->first()->created_at->toIso8601String(),
                'people' => array_values($group->take(3)->map(fn (MovieRequest $r) => $r->user->name)->all()),
            ])
            ->sortByDesc('count')
            ->take(20)
            ->values()
            ->all());
    }

    /** Закрити запит: фільм додали або він не підходить. Прибирає всі запити з цією назвою. */
    public function closeRequest(Request $request): RedirectResponse
    {
        $title = mb_strtolower(trim((string) $request->validate(['title' => ['required', 'string', 'max:160']])['title']));
        $ids = MovieRequest::query()->get(['id', 'title'])
            ->filter(fn (MovieRequest $r) => mb_strtolower(trim($r->title)) === $title)
            ->pluck('id');
        MovieRequest::query()->whereKey($ids)->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запит закрито.']);

        return back();
    }

    public function updateAuto(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'providers' => ['array'],
            'providers.*' => [Rule::in(CinemaService::PROVIDERS)],
            'kodik_types' => ['array'],
            'kodik_types.*' => [Rule::in(array_keys(CinemaAutoImport::KODIK_TYPES))],
            'videoseed_lists' => ['array'],
            'videoseed_lists.*' => [Rule::in(['movie', 'serial'])],
            'pages' => ['required', 'integer', 'between:1,20'],
            'interval' => ['required', Rule::in(CinemaAutoImport::INTERVALS)],
            'publish' => ['required', 'boolean'],
            'enrich' => ['required', 'boolean'],
            'enrich_limit' => ['required', 'integer', 'between:1,500'],
            'min_year' => ['nullable', 'integer', 'between:1900,2100'],
            'only_with_ids' => ['required', 'boolean'],
        ]);

        $this->autoImport->save([
            ...$data,
            'providers' => array_values($data['providers'] ?? []),
            'kodik_types' => array_values($data['kodik_types'] ?? []),
            'videoseed_lists' => array_values($data['videoseed_lists'] ?? ['movie', 'serial']),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $data['enabled'] ? 'Автонаповнення увімкнено.' : 'Налаштування збережено.']);

        return back();
    }

    public function runAuto(Request $request): RedirectResponse
    {
        $enrichOnly = $request->boolean('enrich_only');
        SyncCinemaCatalog::dispatch($enrichOnly);

        Inertia::flash('toast', ['type' => 'success', 'message' => $enrichOnly
            ? 'Збагачення метаданими запущено у фоні.'
            : 'Синхронізацію запущено у фоні — нові тайтли з’являться за кілька хвилин.']);

        return back();
    }

    /**
     * Масова проставка плеєрів на всі тайтли. replace — замінювати наявні плеєри; без нього лише
     * додаються нові озвучки. Що саме змінено — у звіті проставки.
     */
    public function bulkPlayers(Request $request, BulkPlayers $bulk): RedirectResponse
    {
        $data = $request->validate([
            'replace' => ['required', 'boolean'],
            'type' => ['nullable', Rule::in(array_keys(Movie::TYPES))],
            'providers' => ['nullable', 'array'],
            'providers.*' => [Rule::in(['kodik', 'videoseed', 'flixcdn'])],
        ]);
        $started = $bulk->start((bool) $data['replace'], $data['type'] ?? null, array_values($data['providers'] ?? []));
        Inertia::flash('toast', $started
            ? ['type' => 'success', 'message' => $data['replace']
                ? 'Проставку запущено у фоні: плеєри замінюються, нові озвучки додаються.'
                : 'Проставку запущено у фоні: додаються лише нові озвучки.']
            : ['type' => 'error', 'message' => 'Проставка вже виконується.']);

        return back();
    }

    public function cancelBulkPlayers(BulkPlayers $bulk): RedirectResponse
    {
        $bulk->cancel();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Проставку зупинено.']);

        return back();
    }

    /** Плеєри: порядок вкладок, увімкнення, власні назви, улюблені й заборонені озвучки. */
    public function updatePlayers(Request $request): RedirectResponse
    {
        $providers = CinemaPlayers::PROVIDERS;
        $data = $request->validate([
            'order' => ['required', 'array', 'size:'.count($providers)],
            'order.*' => ['distinct', Rule::in($providers)],
            'disabled' => ['array'],
            'disabled.*' => [Rule::in($providers)],
            'labels' => ['array'],
            'labels.*' => ['nullable', 'string', 'max:40'],
            'voice_prefer' => ['array', 'max:30'],
            'voice_prefer.*' => ['string', 'max:60'],
            'voice_block' => ['array', 'max:50'],
            'voice_block.*' => ['string', 'max:60'],
            'episodes' => ['sometimes', 'boolean'],
        ]);

        $this->players->save([
            'order' => array_values($data['order']),
            'disabled' => array_values($data['disabled'] ?? []),
            'labels' => array_filter(array_intersect_key($data['labels'] ?? [], array_flip($providers)), fn ($v) => filled($v)),
            'voice_prefer' => array_values(array_filter(array_map('trim', $data['voice_prefer'] ?? []))),
            'voice_block' => array_values(array_filter(array_map('trim', $data['voice_block'] ?? []))),
            'episodes' => (bool) ($data['episodes'] ?? false),
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування плеєрів збережено.']);

        return back();
    }

    /** Автопарсинг TMDB: поля, режим, оновлення старих і автододавання зі списків. */
    public function updateTmdb(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
            'fields' => ['array'],
            'fields.*' => [Rule::in(array_keys(TmdbAutoParse::FIELDS))],
            'mode' => ['required', Rule::in(['prefer', 'fill'])],
            'refresh_days' => ['required', 'integer', 'between:0,365'],
            'discover' => ['required', 'boolean'],
            'lists' => ['array'],
            'lists.*' => [Rule::in(array_keys(TmdbAutoParse::LIST_LABELS))],
            'pages' => ['required', 'integer', 'between:1,5'],
            'discover_limit' => ['required', 'integer', 'between:1,100'],
            'min_votes' => ['required', 'integer', 'between:0,100000'],
            'min_year' => ['nullable', 'integer', 'between:1900,2100'],
            'publish' => ['required', 'boolean'],
            'language' => ['required', 'string', 'regex:/^[a-z]{2}-[A-Z]{2}$/'],
        ], ['language.regex' => 'Мова у форматі uk-UA.']);

        app(SiteSettings::class)->put(['tmdb_language' => $data['language']]);
        unset($data['language']);
        $this->tmdb->save([...$data, 'fields' => array_values($data['fields'] ?? []), 'lists' => array_values($data['lists'] ?? [])]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Налаштування TMDB збережено.']);

        return back();
    }

    /** Сховати чи показати окрему озвучку фільму. */
    public function toggleSource(Request $request, int $movie, MovieSource $source): RedirectResponse
    {
        abort_unless($source->movie_id === $movie, 404);
        $source->update(['is_hidden' => $request->boolean('is_hidden')]);

        return back();
    }

    /**
     * @return list<array{key: string, label: string, configured: bool, sources: int}>
     */
    private function playerProviders(): array
    {
        $counts = MovieSource::query()->selectRaw('provider, count(*) as total')->groupBy('provider')->pluck('total', 'provider');
        $configured = [
            'kodik' => $this->kodik->configured(),
            'videoseed' => $this->videoseed->configured(),
            'flixcdn' => $this->flixcdn->configured() || $this->flixcdnApi->configured(),
            'custom' => true,
        ];

        return array_map(fn (string $key) => [
            'key' => $key,
            'label' => MovieSource::PROVIDERS[$key],
            'configured' => $configured[$key],
            'sources' => (int) ($counts[$key] ?? 0),
        ], CinemaPlayers::PROVIDERS);
    }

    public function enrich(int $movie): RedirectResponse
    {
        if (! $this->enricher->available()) {
            throw new CinemaException('Підключіть TMDB, Shikimori або OMDb в інтеграціях.', 422);
        }

        $result = $this->enricher->enrich(Movie::withTrashed()->findOrFail($movie));
        Cache::forget('cinema.genres');

        Inertia::flash('toast', match (true) {
            $result['providers'] === [] && $result['errors'] !== [] => ['type' => 'error', 'message' => $result['errors'][0]],
            $result['providers'] === [] => ['type' => 'error', 'message' => 'Жодне джерело не знайшло цей фільм. Додайте ID IMDb, TMDB чи Shikimori.'],
            default => ['type' => 'success', 'message' => 'Дані з '.implode(', ', $result['providers']).': оновлено полів — '.count($result['changed']).'.'],
        });

        return back();
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
        $result = $this->cinema->refresh(Movie::withTrashed()->findOrFail($movie));
        $summary = collect($result)->map(fn (int $n, string $p) => (MovieSource::PROVIDERS[$p] ?? $p).": {$n}")->implode(', ');
        Inertia::flash('toast', ['type' => 'success', 'message' => "Плеєри оновлено ({$summary})."]);

        return back();
    }

    public function import(): Response
    {
        return Inertia::render('admin/cinema-import', [
            'providers' => [
                'kodik' => ['configured' => $this->kodik->configured(), 'search' => $this->kodik->configured(), 'latest' => $this->kodik->configured()],
                'flixcdn' => ['configured' => $this->flixcdnApi->configured(), 'search' => filled($this->flixcdnApi->searchTemplate()), 'latest' => filled($this->flixcdnApi->updatesTemplate())],
                'videoseed' => ['configured' => $this->videoseed->configured(), 'search' => $this->videoseed->configured(), 'latest' => $this->videoseed->configured()],
            ],
            'types' => $this->typeOptions(),
        ]);
    }

    public function remoteSearch(Request $request, string $provider): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'max:150'],
            'by' => ['nullable', Rule::in(['title', 'imdb_id', 'shikimori_id', 'kinopoisk_id', 'tmdb_id'])],
        ]);
        $criteria = [($data['by'] ?? 'title') => trim($data['q'])];

        return $this->candidatesResponse($this->searchProvider($provider, $criteria));
    }

    public function remoteLatest(Request $request, string $provider): JsonResponse
    {
        $data = $request->validate([
            'types' => ['nullable', 'string', 'max:200'],
            'page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        return $this->candidatesResponse(match ($provider) {
            'kodik' => $this->kodik->latest($data['types'] ?? null, 60),
            'videoseed' => $this->videoseed->latest((int) ($data['page'] ?? 1)),
            default => $this->flixcdnApi->updates((int) ($data['page'] ?? 1))['candidates'],
        });
    }

    public function remoteImport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', Rule::in(CinemaService::PROVIDERS)],
            'key' => ['required', 'string', 'max:200'],
            'q' => ['nullable', 'string', 'max:150'],
            'type' => ['nullable', Rule::in(array_keys(Movie::TYPES))],
            'publish' => ['sometimes', 'boolean'],
            'enrich' => ['sometimes', 'boolean'],
        ]);

        [$kind, $value] = array_pad(explode(':', $data['key'], 2), 2, '');
        $criteria = match ($kind) {
            'kp' => ['kinopoisk_id' => $value],
            'shiki' => ['shikimori_id' => $value],
            'imdb' => ['imdb_id' => $value],
            default => ['title' => (string) ($data['q'] ?? '')],
        };

        $results = $this->searchProvider($data['provider'], $criteria);
        $candidate = collect($results)->firstWhere('key', $data['key']);
        if (! $candidate) {
            throw new CinemaException('Провайдер більше не віддає цей матеріал. Оновіть пошук.', 404);
        }
        if (isset($data['type'])) {
            $candidate['type'] = $data['type'];
        }

        $movie = $this->cinema->import($candidate, $request->user(), $data['provider'], $request->has('publish') ? $request->boolean('publish') : null);
        $enriched = null;
        if ($request->boolean('enrich', true) && $this->enricher->available()) {
            $enriched = $this->enricher->enrich($movie)['providers'];
        }
        Cache::forget('cinema.genres');

        return response()->json([
            'movie' => [...$movie->fresh()->toCard(), 'admin_href' => '/admin/cinema/'.$movie->id.'/edit'],
            'sources' => $movie->sources()->count(),
            'message' => "«{$movie->title}» імпортовано: озвучок — ".count($candidate['sources']).($enriched ? '; метадані: '.implode(', ', $enriched) : '').'.',
        ]);
    }

    /**
     * @param  array<string, string>  $criteria
     * @return list<array<string, mixed>>
     */
    private function searchProvider(string $provider, array $criteria): array
    {
        return match ($provider) {
            'kodik' => $this->kodik->search($criteria),
            'videoseed' => $this->videoseed->search($criteria),
            default => $this->flixcdnApi->search($criteria),
        };
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

                $sources = $this->candidateSources($c);
                $translations = [];
                $quality = null;
                foreach ($sources as $source) {
                    $translation = $source['translation'] ?? null;
                    if (is_scalar($translation)) {
                        $translation = trim((string) $translation);
                        if ($translation !== '' && ! in_array($translation, $translations, true)) {
                            $translations[] = $translation;
                        }
                    }
                    if ($quality === null) {
                        $candidateQuality = $source['quality'] ?? null;
                        if (is_scalar($candidateQuality) && trim((string) $candidateQuality) !== '') {
                            $quality = $candidateQuality;
                        }
                    }
                }

                return [
                    ...collect($c)->except(['sources', 'rating_kp', 'kinopoisk_id'])->all(),
                    'type_label' => Movie::TYPES[$c['type']] ?? $c['type'],
                    'translations' => $translations,
                    'sources_count' => count($sources),
                    'quality' => $quality,
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
                    'tagline', 'trailer_url', 'rating_tmdb', 'tmdb_id', 'origin', 'description', 'poster_url', 'backdrop_url', 'countries', 'duration', 'age_rating', 'rating_imdb', 'rating_shikimori',
                    'imdb_id', 'shikimori_id', 'is_published', 'is_featured', 'comments_enabled', 'views_count', 'watchers_count',
                    'comments_count', 'ratings_count',
                ]),
                'genres' => $movie->genres ?? [],
                'countries' => $movie->countries ?? [],
                'has_poster_file' => $movie->poster_path !== null,
                'has_backdrop_file' => $movie->backdrop_path !== null,
                'user_rating' => $movie->userRating(),
                'deleted_at' => $movie->deleted_at?->toIso8601String(),
                'enriched_at' => $movie->enriched_at?->toIso8601String(),
                'synced_at' => $movie->synced_at?->toIso8601String(),
                'sources' => $movie->sources->map(fn (MovieSource $s) => $s->toPlayer())->values(),
                'flixcdn_link' => $this->flixcdn->link($movie),
            ] : null,
            'types' => $this->typeOptions(),
            'providers' => $this->providers(),
            'metadata' => collect($this->enricher->providers())->map(fn (MetadataProvider $p) => ['key' => $p->key(), 'label' => $p->label(), 'configured' => $p->configured()])->values(),
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
            'rating_imdb' => ['nullable', 'numeric', 'between:0,10'],
            'rating_shikimori' => ['nullable', 'numeric', 'between:0,10'],
            'rating_tmdb' => ['nullable', 'numeric', 'between:0,10'],
            'tagline' => ['nullable', 'string', 'max:300'],
            'trailer_url' => ['nullable', 'url:https', 'max:500'],
            'tmdb_id' => ['nullable', 'string', 'max:30', 'regex:/^(movie|tv):\d+$/'],
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
            'shikimori_id.regex' => 'ID Shikimori — лише цифри.',
            'tmdb_id.regex' => 'TMDB ID має вигляд movie:603 або tv:1399.',
        ]);

        $clean = fn (?array $list) => array_values(array_unique(array_filter(array_map(fn ($v) => trim((string) $v), $list ?? []))));

        $attributes = $data;
        unset($attributes['poster'], $attributes['backdrop'], $attributes['remove_poster'], $attributes['remove_backdrop'], $attributes['genres'], $attributes['countries']);

        $movie->fill([
            ...$attributes,
            'genres' => $clean($data['genres'] ?? null) ?: null,
            'countries' => $clean($data['countries'] ?? null) ?: null,
        ]);
        $movie->slug ??= $this->cinema->uniqueSlug($movie->title, $movie->year);
        if (filled($data['trailer_url'] ?? null)) {
            $movie->trailer_url = $this->embedLink($data['trailer_url']);
        }

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
        return array_values(collect(Movie::TYPES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->all());
    }

    /**
     * @param  array<string, mixed>  $candidate
     * @return list<array<string, mixed>>
     */
    private function candidateSources(array $candidate): array
    {
        $raw = $candidate['sources'] ?? null;
        if (! is_array($raw)) {
            return [];
        }

        $sources = [];
        foreach ($raw as $source) {
            if (! is_array($source)) {
                continue;
            }
            $row = [];
            foreach ($source as $key => $value) {
                if (is_string($key)) {
                    $row[$key] = $value;
                }
            }
            $sources[] = $row;
        }

        return $sources;
    }

    /**
     * @return array{kodik: bool, videoseed: bool, flixcdn: bool, flixcdn_api: bool, metadata: bool}
     */
    private function providers(): array
    {
        return [
            'kodik' => $this->kodik->configured(),
            'videoseed' => $this->videoseed->configured(),
            'flixcdn' => $this->flixcdn->configured() || $this->flixcdnApi->configured(),
            'flixcdn_api' => $this->flixcdnApi->configured(),
            'metadata' => $this->enricher->available(),
        ];
    }
}
