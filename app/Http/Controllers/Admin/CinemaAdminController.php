<?php

namespace App\Http\Controllers\Admin;

use App\Cinema\CinemaSettings;
use App\Cinema\FlixCdn;
use App\Cinema\ImportTitleJob;
use App\Cinema\Importer;
use App\Cinema\Kodik;
use App\Cinema\PlayerSources;
use App\Cinema\Title;
use App\Cinema\Tmdb;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/** Адмінка кінопорталу: ключі API, імпорт із TMDB, каталог. */
class CinemaAdminController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('q', ''));
        $type = $request->query('type');
        $titles = Title::query()
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w->where('name', 'like', "%{$search}%")->orWhere('original_name', 'like', "%{$search}%")))
            ->when(in_array($type, ['movie', 'series'], true), fn ($q) => $q->where('type', $type))
            ->orderByDesc('created_at')->paginate(30)->withQueryString()
            ->through(fn (Title $t) => [
                'id' => $t->id,
                'type' => $t->type,
                'category' => $t->category,
                'name' => $t->name,
                'year' => $t->year,
                'poster' => Tmdb::image($t->poster_path, 'w92'),
                'rating' => $t->vote_average,
                'localRating' => $t->local_rating,
                'published' => $t->is_published,
                'featured' => $t->is_featured,
                'hasPlayer' => PlayerSources::hasAny($t),
                'kodikChecked' => $t->kodik_checked_at?->toIso8601String(),
                'flixcdnChecked' => $t->flixcdn_checked_at?->toIso8601String(),
            ]);

        return Inertia::render('Admin/Cinema/Index', [
            'titles' => $titles,
            'filters' => ['q' => $search, 'type' => $type],
            'settings' => [
                'tmdbConfigured' => Tmdb::configured(),
                'kodikConfigured' => Kodik::configured(),
                'flixcdnConfigured' => FlixCdn::configured(),
                'language' => CinemaSettings::language(),
            ],
            'categories' => collect(Title::CATEGORIES)->map(fn ($m, $k) => ['key' => $k, 'name' => $m[0]])->values(),
            'stats' => [
                'movies' => Title::query()->where('type', 'movie')->count(),
                'series' => Title::query()->where('type', 'series')->count(),
                'withPlayer' => Title::query()->where(fn ($q) => $q->whereNotNull('kodik_link')->orWhereNotNull('flixcdn_link'))->count(),
                'reviews' => DB::table('cinema_reviews')->count(),
                'watchlist' => DB::table('cinema_watchlist')->count(),
            ],
        ]);
    }

    public function settings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'tmdbKey' => ['nullable', 'string', 'max:400'],
            'kodikToken' => ['nullable', 'string', 'max:200'],
            'flixcdnToken' => ['nullable', 'string', 'max:200'],
            'language' => ['required', 'string', 'regex:/^[a-z]{2}-[A-Z]{2}$/'],
            'clearTmdb' => ['nullable', 'boolean'],
            'clearKodik' => ['nullable', 'boolean'],
            'clearFlixcdn' => ['nullable', 'boolean'],
        ]);
        // Порожнє поле — «не змінювати»: ключ не повертається у форму.
        if (! empty($data['clearTmdb'])) {
            CinemaSettings::setSecret(CinemaSettings::TMDB_KEY, null);
        } elseif (! empty($data['tmdbKey'])) {
            CinemaSettings::setSecret(CinemaSettings::TMDB_KEY, $data['tmdbKey']);
        }
        if (! empty($data['clearKodik'])) {
            CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, null);
        } elseif (! empty($data['kodikToken'])) {
            CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, $data['kodikToken']);
        }
        if (! empty($data['clearFlixcdn'])) {
            CinemaSettings::setSecret(CinemaSettings::FLIXCDN_TOKEN, null);
        } elseif (! empty($data['flixcdnToken'])) {
            CinemaSettings::setSecret(CinemaSettings::FLIXCDN_TOKEN, $data['flixcdnToken']);
        }
        Setting::set(CinemaSettings::LANGUAGE, $data['language'], 'cinema');

        return back()->with('status', 'Налаштування кінопорталу збережено.');
    }

    /** Списки й пошук TMDB — для вибору, що імпортувати. */
    public function tmdb(Request $request): JsonResponse
    {
        $data = $request->validate([
            'list' => ['required', 'in:trending,popular_movies,popular_series,top_movies,top_series,now_playing,anime,dorama,cartoons,search'],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);
        try {
            return response()->json(Importer::browse($data['list'], (int) ($data['page'] ?? 1), $data['q'] ?? null));
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    /** Імпорт одного (посилання TMDB, «tv:1399» або вибір зі списку). */
    public function import(Request $request): JsonResponse|RedirectResponse
    {
        $data = $request->validate([
            'reference' => ['nullable', 'string', 'max:300'],
            'type' => ['nullable', 'in:movie,series'],
            'tmdbId' => ['nullable', 'integer'],
        ]);
        $ref = ! empty($data['tmdbId']) && ! empty($data['type']) ? [$data['type'], (int) $data['tmdbId']] : Importer::parseReference((string) ($data['reference'] ?? ''));
        if (! $ref) {
            return back()->withErrors(['reference' => 'Вставте посилання TMDB (…/movie/603 або …/tv/1399) або «movie:603».']);
        }
        try {
            $title = Importer::import($ref[0], $ref[1]);
        } catch (\Throwable $e) {
            return $request->expectsJson() && ! $request->header('X-Inertia')
                ? response()->json(['message' => $e->getMessage()], 422)
                : back()->withErrors(['reference' => $e->getMessage()]);
        }

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json(['id' => $title->id, 'name' => $title->name])
            : back()->with('status', "Імпортовано: {$title->name}".(PlayerSources::hasAny($title) ? ' (плеєр знайдено)' : ''));
    }

    /** Масовий імпорт списку TMDB — у черзі. */
    public function bulk(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'list' => ['required', 'in:trending,popular_movies,popular_series,top_movies,top_series,now_playing,anime,dorama,cartoons'],
            'pages' => ['required', 'integer', 'min:1', 'max:10'],
        ]);
        $queued = 0;
        try {
            for ($page = 1; $page <= $data['pages']; $page++) {
                foreach (Importer::browse($data['list'], $page) as $row) {
                    if (! $row['imported']) {
                        ImportTitleJob::dispatch($row['type'], $row['tmdbId']);
                        $queued++;
                    }
                }
            }
        } catch (\Throwable $e) {
            return back()->withErrors(['bulk' => $e->getMessage()]);
        }

        return back()->with('status', "У черзі на імпорт: {$queued}. Каталог поповниться за кілька хвилин.");
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $data = $request->validate(['published' => ['sometimes', 'boolean'], 'featured' => ['sometimes', 'boolean'], 'category' => ['sometimes', 'in:'.implode(',', array_keys(Title::CATEGORIES))]]);
        $title = Title::query()->findOrFail($id);
        $title->update(array_filter([
            'is_published' => $data['published'] ?? null,
            'is_featured' => $data['featured'] ?? null,
            'category' => $data['category'] ?? null,
        ], fn ($v) => $v !== null));

        return back();
    }

    public function refresh(int $id): RedirectResponse
    {
        $title = Title::query()->findOrFail($id);
        try {
            Importer::import($title->type, (int) $title->tmdb_id);
        } catch (\Throwable $e) {
            return back()->withErrors(['reference' => $e->getMessage()]);
        }

        return back()->with('status', "Оновлено з TMDB: {$title->name}");
    }

    public function kodik(int $id): RedirectResponse
    {
        $title = Title::query()->findOrFail($id);
        if (! Kodik::configured()) {
            return back()->withErrors(['reference' => 'Спершу вкажіть токен Kodik у налаштуваннях.']);
        }

        return Kodik::attach($title)
            ? back()->with('status', "Плеєр знайдено: {$title->name}")
            : back()->withErrors(['reference' => "Kodik не знайшов «{$title->name}»."]);
    }

    public function flixcdn(int $id): RedirectResponse
    {
        $title = Title::query()->findOrFail($id);
        if (! FlixCdn::configured()) {
            return back()->withErrors(['reference' => 'Спершу вкажіть токен FlixCDN у налаштуваннях.']);
        }

        return FlixCdn::attach($title)
            ? back()->with('status', "Плеєр FlixCDN знайдено: {$title->name}")
            : back()->withErrors(['reference' => "FlixCDN не знайшов «{$title->name}»."]);
    }

    public function destroy(int $id): RedirectResponse
    {
        $title = Title::query()->findOrFail($id);
        $title->delete();

        return back()->with('status', "Видалено: {$title->name}");
    }
}
