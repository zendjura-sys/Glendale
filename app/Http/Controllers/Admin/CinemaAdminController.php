<?php

namespace App\Http\Controllers\Admin;

use App\Cinema\AttachPlayerJob;
use App\Cinema\CinemaSettings;
use App\Cinema\Episode;
use App\Cinema\FlixCdn;
use App\Cinema\ImportTitleJob;
use App\Cinema\Importer;
use App\Cinema\Kodik;
use App\Cinema\Kodik\KodikRebindDispatcher;
use App\Cinema\PlayerSources;
use App\Cinema\Season;
use App\Cinema\Title;
use App\Cinema\Tmdb;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
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
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w->where('name', 'like', "%{$search}%")->orWhere('original_name', 'like', "%{$search}%")->orWhere('alt_names', 'like', "%{$search}%")))
            ->when(in_array($type, ['movie', 'series'], true), fn ($q) => $q->where('type', $type))
            ->orderByDesc('created_at')->paginate(30)->withQueryString()
            ->through(fn (Title $t) => [
                'id' => $t->id,
                'type' => $t->type,
                'category' => $t->category,
                'name' => $t->name,
                'year' => $t->year,
                'tmdbId' => $t->tmdb_id,
                'shikimoriId' => $t->shikimori_id,
                'imdbId' => $t->imdb_id,
                'mdlId' => $t->mdl_id,
                'worldartLink' => $t->worldart_link,
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
                'blacklist' => CinemaSettings::blacklistText(),
                'minYear' => CinemaSettings::minYear(),
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
            'blacklist' => ['nullable', 'string', 'max:4000'],
            'minYear' => ['nullable', 'integer', 'min:1900', 'max:2100'],
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
        Setting::set(CinemaSettings::BLACKLIST, trim((string) ($data['blacklist'] ?? '')) ?: null, 'cinema');
        Setting::set(CinemaSettings::MIN_YEAR, isset($data['minYear']) ? (string) $data['minYear'] : null, 'cinema');

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

    /**
     * Кнопка «Проставити Kodik/FlixCDN на всі» — окрема для кожного
     * джерела: у чергу йдуть лише тайтли, яким саме цього плеєра ще
     * бракує (за раз до 500, щоб не покласти ліміти API одним кліком —
     * повторний клік підхопить решту).
     */
    public function bulkAttachPlayers(Request $request, KodikRebindDispatcher $kodikRebind): RedirectResponse
    {
        $data = $request->validate(['source' => ['required', 'in:kodik,flixcdn,shikimori']]);
        $source = $data['source'];

        if ($source === 'kodik' && ! Kodik::configured()) {
            return back()->withErrors(['bulk' => 'Спершу вкажіть токен Kodik у налаштуваннях.']);
        }
        if ($source === 'flixcdn' && ! FlixCdn::configured()) {
            return back()->withErrors(['bulk' => 'Спершу вкажіть токен FlixCDN у налаштуваннях.']);
        }

        if ($source === 'kodik') {
            $run = $kodikRebind->dispatch(true, $request->user()->id);

            return back()->with('status', "У черзі на пошук Kodik: {$run->counters['queued']}.");
        }

        $query = match ($source) {
            'flixcdn' => Title::query()->whereNull('flixcdn_link'),
            // Shikimori — лише каталог аніме, для решти категорій id не існує.
            'shikimori' => Title::query()->where('category', 'anime')->whereNull('shikimori_id'),
        };
        $ids = $query->orderBy('id')->limit(500)->pluck('id');
        foreach ($ids as $id) {
            AttachPlayerJob::dispatch($source, $id);
        }

        $label = ['kodik' => 'Kodik', 'flixcdn' => 'FlixCDN', 'shikimori' => 'Shikimori ID'][$source];

        return back()->with('status', "У черзі на пошук {$label}: {$ids->count()}. Результат з'явиться за кілька хвилин.");
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $title = Title::query()->findOrFail($id);
        $data = $request->validate([
            'published' => ['sometimes', 'boolean'],
            'featured' => ['sometimes', 'boolean'],
            'category' => ['sometimes', 'in:'.implode(',', array_keys(Title::CATEGORIES))],
            // Приховані від користувачів ідентифікатори — лише в адмінці:
            // Kodik::search пробує їх у порядку точності (shikimori_id →
            // imdb_id → mdl_id → worldart_link → назва/рік востаннє).
            'tmdb_id' => ['sometimes', 'nullable', 'integer', 'unique:cinema_titles,tmdb_id,'.$title->id.',id,type,'.$title->type],
            'shikimori_id' => ['sometimes', 'nullable', 'integer'],
            'imdb_id' => ['sometimes', 'nullable', 'string', 'max:20'],
            'mdl_id' => ['sometimes', 'nullable', 'integer'],
            'worldart_link' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);
        // Ці поля можуть свідомо очищуватись (null) — на відміну від
        // published/featured/category, array_filter тут не годиться, бо
        // він прибрав би саме null-значення.
        $updates = array_filter([
            'is_published' => $data['published'] ?? null,
            'is_featured' => $data['featured'] ?? null,
            'category' => $data['category'] ?? null,
        ], fn ($v) => $v !== null);
        foreach (['tmdb_id', 'shikimori_id', 'imdb_id', 'mdl_id', 'worldart_link'] as $key) {
            if (array_key_exists($key, $data)) {
                $updates[$key] = $data[$key];
            }
        }
        $title->update($updates);

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

    /**
     * Ручне керування сезонами й серіями — для власних/ексклюзивних релізів,
     * яких немає на TMDB (звичайний імпорт їх ніяк не підхопить). Номер, що
     * збігається з реальним сезоном TMDB, згодом може перезаписатись
     * автооновленням (cinema:auto-import) — це прийнятний компроміс, той
     * самий, що й у сторонніх граберах з таким самим ручним режимом.
     */
    public function seasons(int $id): JsonResponse
    {
        $title = Title::query()->findOrFail($id);

        return response()->json($title->seasons()->with('episodes')->orderBy('number')->get());
    }

    public function storeSeason(Request $request, int $id): RedirectResponse
    {
        $title = Title::query()->findOrFail($id);
        $data = $request->validate([
            'number' => ['required', 'integer', 'min:0', 'max:200', Rule::unique('cinema_seasons')->where('title_id', $title->id)],
            'name' => ['nullable', 'string', 'max:200'],
            'overview' => ['nullable', 'string', 'max:2000'],
        ]);
        $title->seasons()->create($data);

        return back()->with('status', "Сезон {$data['number']} додано.");
    }

    public function updateSeason(Request $request, int $seasonId): RedirectResponse
    {
        $season = Season::query()->findOrFail($seasonId);
        $data = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:200'],
            'overview' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);
        $season->update($data);

        return back();
    }

    public function destroySeason(int $seasonId): RedirectResponse
    {
        $season = Season::query()->findOrFail($seasonId);
        $season->delete();

        return back()->with('status', "Сезон {$season->number} видалено.");
    }

    public function storeEpisode(Request $request, int $seasonId): RedirectResponse
    {
        $season = Season::query()->findOrFail($seasonId);
        $data = $request->validate([
            'number' => ['required', 'integer', 'min:1', 'max:2000', Rule::unique('cinema_episodes')->where('season_id', $season->id)],
            'name' => ['nullable', 'string', 'max:200'],
            'overview' => ['nullable', 'string', 'max:2000'],
            'air_date' => ['nullable', 'date'],
            'runtime' => ['nullable', 'integer', 'min:1', 'max:600'],
        ]);
        $season->episodes()->create($data + ['title_id' => $season->title_id]);
        $season->update(['episodes_count' => max($season->episodes_count, $data['number']), 'episodes_loaded_at' => now()]);

        return back()->with('status', "Серію {$data['number']} додано.");
    }

    public function updateEpisode(Request $request, int $episodeId): RedirectResponse
    {
        $episode = Episode::query()->findOrFail($episodeId);
        $data = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:200'],
            'overview' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'air_date' => ['sometimes', 'nullable', 'date'],
            'runtime' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:600'],
        ]);
        $episode->update($data);

        return back();
    }

    public function destroyEpisode(int $episodeId): RedirectResponse
    {
        $episode = Episode::query()->findOrFail($episodeId);
        $episode->delete();

        return back()->with('status', "Серію {$episode->number} видалено.");
    }
}
