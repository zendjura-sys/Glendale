<?php

namespace App\Http\Controllers\Api\V2;

use App\Cinema\CinemaPresenter;
use App\Cinema\Genre;
use App\Cinema\Importer;
use App\Cinema\Person;
use App\Cinema\PlayerSources;
use App\Cinema\Season;
use App\Cinema\Title;
use App\Cinema\Tmdb;
use App\Families\FamilyContext;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Social\Presenter;
use App\Social\Social;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Кінопортал: каталог, сторінка фільму/серіалу, плеєр, оцінки й рецензії,
 * «Хочу подивитись», прогрес перегляду. І зв'язки з рештою сайту: оцінки
 * друзів і родини, «порадити другу», «переглянути з родиною».
 */
class CinemaController extends Controller
{
    private function title(int $id, bool $published = true): Title
    {
        $title = Title::query()->when($published, fn ($q) => $q->published())->find($id);
        if (! $title) {
            Social::fail(404, 'Фільм не знайдено');
        }

        return $title;
    }

    public function home(Request $request): JsonResponse
    {
        $me = $request->user();
        $base = fn () => Title::query()->published()->with('genres');
        $continue = DB::table('cinema_progress')->where('user_id', $me->id)->where('position', '>', 30)
            ->orderByDesc('updated_at')->limit(12)->pluck('title_id');
        $watchlist = DB::table('cinema_watchlist')->where('user_id', $me->id)->orderByDesc('created_at')->limit(12)->pluck('title_id');
        $byIds = fn ($ids) => $ids->isEmpty() ? [] : CinemaPresenter::cards($base()->whereIn('id', $ids)->get()->sortBy(fn ($t) => $ids->search($t->id)));

        // Що дивляться друзі й родина — останні оцінки кола людини.
        $circle = DB::table('social_friends')->where('user_id', $me->id)->pluck('friend_id')
            ->merge(DB::table('family_members')->whereIn('family_id', DB::table('family_members')->where('user_id', $me->id)->select('family_id'))->pluck('user_id'))
            ->reject(fn ($id) => $id === $me->id)->unique();
        $circleTitles = $circle->isEmpty() ? collect() : DB::table('cinema_reviews')->whereIn('user_id', $circle)
            ->orderByDesc('updated_at')->limit(30)->pluck('title_id')->unique()->take(12)->values();

        return response()->json([
            'featured' => CinemaPresenter::spotlights($base()->where('is_featured', true)->orderByDesc('popularity')->limit(10)->get()
                ->whenEmpty(fn () => $base()->whereNotNull('backdrop_path')->orderByDesc('popularity')->limit(8)->get()), $me),
            'continue' => $byIds($continue),
            'watchlist' => $byIds($watchlist),
            'circle' => $byIds($circleTitles),
            'movies' => CinemaPresenter::cards($base()->where('type', 'movie')->orderByDesc('popularity')->limit(18)->get()),
            'series' => CinemaPresenter::cards($base()->where('type', 'series')->orderByDesc('popularity')->limit(18)->get()),
            'top' => CinemaPresenter::cards($base()->where('vote_count', '>=', 100)->orderByDesc('vote_average')->limit(18)->get()),
            'fresh' => CinemaPresenter::cards($base()->orderByDesc('created_at')->limit(18)->get()),
            'genres' => Genre::query()->orderBy('name')->get(['id', 'name'])->all(),
            'trending' => CinemaPresenter::cards($this->trending(5)),
            'categories' => $this->categories(),
        ]);
    }

    /** «Тренди сьогодні»: що найбільше дивились, додавали й оцінювали за 3 дні. */
    private function trending(int $limit)
    {
        $since = now()->subDays(3);
        $scores = DB::table('cinema_progress')->where('updated_at', '>=', $since)->select('title_id')
            ->unionAll(DB::table('cinema_watchlist')->where('created_at', '>=', $since)->select('title_id'))
            ->unionAll(DB::table('cinema_reviews')->where('updated_at', '>=', $since)->select('title_id'));
        $ids = DB::query()->fromSub($scores, 'a')->select('title_id', DB::raw('COUNT(*) as n'))
            ->groupBy('title_id')->orderByDesc('n')->limit($limit)->pluck('title_id');
        $titles = Title::query()->published()->with('genres')->whereIn('id', $ids)->get()->sortBy(fn ($t) => $ids->search($t->id))->values();
        if ($titles->count() < $limit) {
            $titles = $titles->merge(Title::query()->published()->with('genres')->whereNotIn('id', $titles->pluck('id'))
                ->orderByDesc('popularity')->limit($limit - $titles->count())->get());
        }

        return $titles;
    }

    /** Плитки розділів вітрини з кадром найпопулярнішого тайтлу. */
    private function categories(): array
    {
        $counts = Title::query()->published()->selectRaw('category, COUNT(*) as n')->groupBy('category')->pluck('n', 'category');

        return collect(Title::CATEGORIES)->map(function ($meta, $key) use ($counts) {
            $top = Title::query()->published()->where('category', $key)->whereNotNull('backdrop_path')->orderByDesc('popularity')->first();

            return [
                'key' => $key,
                'name' => $meta[0],
                'caption' => $meta[1],
                'count' => (int) ($counts[$key] ?? 0),
                'image' => $top ? Tmdb::image($top->backdrop_path, 'w780') : null,
            ];
        })->values()->all();
    }

    /** Історія перегляду: усе, що людина починала дивитись. */
    public function history(Request $request): JsonResponse
    {
        $rows = DB::table('cinema_progress')->where('user_id', $request->user()->id)->orderByDesc('updated_at')->limit(60)->get()->keyBy('title_id');
        $titles = Title::query()->published()->with('genres')->whereIn('id', $rows->keys())->get()->keyBy('id');

        return response()->json($rows->filter(fn ($r) => isset($titles[$r->title_id]))->map(fn ($r) => CinemaPresenter::card($titles[$r->title_id]) + [
            'progress' => ['position' => (int) $r->position, 'duration' => $r->duration ? (int) $r->duration : null, 'season' => $r->season, 'episode' => $r->episode],
            'watchedAt' => Presenter::ms($r->updated_at),
        ])->values());
    }

    public function browse(Request $request): JsonResponse
    {
        $request->validate(['type' => ['nullable', 'in:movie,series'], 'category' => ['nullable', 'in:'.implode(',', array_keys(Title::CATEGORIES))], 'genre' => ['nullable', 'integer'], 'year' => ['nullable', 'integer'],
            'sort' => ['nullable', 'in:popular,rating,new,year'], 'q' => ['nullable', 'string', 'max:100'], 'page' => ['nullable', 'integer', 'min:1']]);
        $search = $request->query('q');
        $page = $this->browseQuery($request)->paginate(30);

        // Локально нічого не знайшлось за пошуковим запитом — пробуємо ті самі
        // слова в TMDB й одразу підвантажуємо перші збіги (разом із плеєрами),
        // щоб людина не бачила «нічого не знайдено» на тайтл, якого просто ще
        // не було в каталозі.
        if ($search && (int) $request->query('page', 1) === 1 && $page->total() === 0) {
            $this->importFromTmdb((string) $search);
            $page = $this->browseQuery($request)->paginate(30);
        }

        return response()->json(['items' => CinemaPresenter::cards($page->items()), 'hasMore' => $page->hasMorePages(), 'total' => $page->total()]);
    }

    private function browseQuery(Request $request)
    {
        $q = Title::query()->published()->with('genres')
            ->when($request->query('type'), fn ($b, $t) => $b->where('type', $t))
            ->when($request->query('category'), fn ($b, $c) => $b->where('category', $c))
            ->when($request->query('genre'), fn ($b, $g) => $b->whereHas('genres', fn ($h) => $h->where('cinema_genres.id', $g)))
            ->when($request->query('year'), fn ($b, $y) => $b->where('year', $y))
            ->when($request->query('q'), fn ($b, $s) => $b->where(fn ($w) => $w->where('name', 'like', "%{$s}%")->orWhere('original_name', 'like', "%{$s}%")->orWhere('alt_names', 'like', "%{$s}%")));
        match ($request->query('sort', 'popular')) {
            'rating' => $q->orderByDesc('vote_average'),
            'new' => $q->orderByDesc('created_at'),
            'year' => $q->orderByDesc('release_date'),
            default => $q->orderByDesc('popularity'),
        };

        return $q;
    }

    /** Каталог порожній за цим запитом — пробуємо кілька найкращих збігів із TMDB. */
    private function importFromTmdb(string $query): void
    {
        if (! Tmdb::configured()) {
            return;
        }
        try {
            $results = Importer::browse('search', 1, $query);
        } catch (\Throwable) {
            return;
        }
        $new = array_values(array_filter($results, fn ($r) => ! $r['imported']));
        foreach (array_slice($new, 0, 1) as $r) {
            try {
                Importer::import($r['type'], $r['tmdbId']);
            } catch (\Throwable) {
                // Одна невдала картка (мережа, рейт-ліміт) не повинна ламати решту пошуку.
            }
        }
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $title = $this->title($id, ! $request->user()->can('cinema.manage'));
        $similar = Title::query()->published()->with('genres')->where('id', '!=', $title->id)->where('type', $title->type)
            ->whereHas('genres', fn ($h) => $h->whereIn('cinema_genres.id', $title->genres()->pluck('cinema_genres.id')))
            ->orderByDesc('popularity')->limit(12)->get();

        return response()->json(CinemaPresenter::full($title, $request->user()) + ['similar' => CinemaPresenter::cards($similar)]);
    }

    public function season(Request $request, int $id, int $number): JsonResponse
    {
        $title = $this->title($id);
        $season = Season::query()->where('title_id', $title->id)->where('number', $number)->first();
        if (! $season) {
            Social::fail(404, 'Сезон не знайдено');
        }
        if (! $season->episodes_loaded_at && $title->tmdb_id && Tmdb::configured()) {
            try {
                $season = Importer::importSeason($title, $season);
            } catch (\Throwable) {
                // TMDB недоступний — покажемо, що є.
            }
        }

        return response()->json($season->episodes()->get()->map(fn ($e) => [
            'number' => $e->number,
            'name' => $e->name,
            'overview' => (string) $e->overview,
            'still' => Tmdb::image($e->still_path, 'w300'),
            'airDate' => $e->air_date?->toDateString(),
            'runtime' => $e->runtime,
        ])->values());
    }

    /** Посилання на плеєр (Kodik + FlixCDN паралельно) — з обраним джерелом і місцем, де людина зупинилась. */
    public function player(Request $request, int $id): JsonResponse
    {
        $title = $this->title($id);
        PlayerSources::autoAttach($title);
        $index = (int) $request->query('translation', 0);
        $link = PlayerSources::linkFor($title, $index);
        if (! $link) {
            Social::fail(404, 'Плеєр для цього фільму ще не знайдено', 'no_player');
        }
        $progress = DB::table('cinema_progress')->where('title_id', $title->id)->where('user_id', $request->user()->id)->first();

        return response()->json([
            'link' => $link,
            'translation' => $index,
            'progress' => $progress ? ['season' => $progress->season, 'episode' => $progress->episode, 'position' => (int) $progress->position] : null,
        ]);
    }

    public function progress(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'season' => ['nullable', 'integer', 'min:0', 'max:200'],
            'episode' => ['nullable', 'integer', 'min:0', 'max:5000'],
            'position' => ['required', 'integer', 'min:0'],
            'duration' => ['nullable', 'integer', 'min:0'],
        ]);
        $title = $this->title($id);
        DB::table('cinema_progress')->updateOrInsert(
            ['user_id' => $request->user()->id, 'title_id' => $title->id],
            ['season' => $data['season'] ?? null, 'episode' => $data['episode'] ?? null, 'position' => $data['position'], 'duration' => $data['duration'] ?? null, 'updated_at' => now()],
        );

        return response()->json(['ok' => true]);
    }

    public function watchlistAdd(Request $request, int $id): JsonResponse
    {
        $title = $this->title($id);
        DB::table('cinema_watchlist')->insertOrIgnore(['user_id' => $request->user()->id, 'title_id' => $title->id, 'created_at' => now()]);

        return response()->json(['inWatchlist' => true]);
    }

    public function watchlistRemove(Request $request, int $id): JsonResponse
    {
        DB::table('cinema_watchlist')->where('user_id', $request->user()->id)->where('title_id', $id)->delete();

        return response()->json(['inWatchlist' => false]);
    }

    public function watchlist(Request $request): JsonResponse
    {
        $ids = DB::table('cinema_watchlist')->where('user_id', $request->user()->id)->orderByDesc('created_at')->pluck('title_id');

        return response()->json(CinemaPresenter::cards(Title::query()->published()->with('genres')->whereIn('id', $ids)->get()->sortBy(fn ($t) => $ids->search($t->id))));
    }

    /** Оцінка 1–10 і рецензія; за бажанням — одразу запис у стрічку. */
    public function review(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:10'],
            'body' => ['nullable', 'string', 'max:5000'],
            'share' => ['nullable', 'boolean'],
        ]);
        $title = $this->title($id);
        $me = $request->user();
        DB::table('cinema_reviews')->updateOrInsert(
            ['title_id' => $title->id, 'user_id' => $me->id],
            ['rating' => $data['rating'], 'body' => $data['body'] ?? null, 'updated_at' => now(), 'created_at' => now()],
        );
        $this->recount($title);

        if (! empty($data['share'])) {
            DB::table('social_posts')->insert([
                'author_id' => $me->id, 'owner_type' => 'user', 'owner_id' => $me->id, 'from_group' => false,
                'text' => trim('⭐ '.$data['rating'].'/10'.(($data['body'] ?? '') !== '' ? "\n\n".$data['body'] : '')),
                'spotify' => '', 'cinema_title_id' => $title->id, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        return response()->json(CinemaPresenter::full($title->fresh(), $me));
    }

    public function reviewDelete(Request $request, int $id): JsonResponse
    {
        $title = $this->title($id);
        DB::table('cinema_reviews')->where('title_id', $title->id)->where('user_id', $request->user()->id)->delete();
        $this->recount($title);

        return response()->json(CinemaPresenter::full($title->fresh(), $request->user()));
    }

    public function reviews(Request $request, int $id): JsonResponse
    {
        $title = $this->title($id);
        $rows = DB::table('cinema_reviews')->where('title_id', $title->id)->orderByDesc('updated_at')->limit(50)->get();
        $users = Presenter::users($rows->pluck('user_id')->all());

        return response()->json($rows->map(fn ($r) => [
            'user' => Presenter::userShort($users[$r->user_id] ?? null),
            'rating' => (int) $r->rating,
            'body' => (string) $r->body,
            'updatedAt' => Presenter::ms($r->updated_at),
        ])->values());
    }

    /** «Порадити другу» — сповіщення з посиланням на фільм. */
    public function recommend(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['userIds' => ['required', 'array', 'min:1', 'max:20'], 'userIds.*' => ['integer']]);
        $title = $this->title($id);
        $me = $request->user();
        $sent = 0;
        foreach (array_unique($data['userIds']) as $uid) {
            $uid = (int) $uid;
            $allowed = Social::areFriends($me->id, $uid)
                || DB::table('family_members as a')->join('family_members as b', 'a.family_id', '=', 'b.family_id')
                    ->where('a.user_id', $me->id)->where('b.user_id', $uid)->exists();
            if (! $allowed || $uid === $me->id) {
                continue;
            }
            DB::table('social_notifications')->insert([
                'user_id' => $uid, 'actor_id' => $me->id, 'type' => 'cinema_recommend', 'cinema_title_id' => $title->id,
                'text' => mb_substr($title->name, 0, 200), 'created_at' => now(),
            ]);
            $sent++;
        }

        return response()->json(['sent' => $sent]);
    }

    /** «Переглянути з родиною» — подія в календарі родини (для лідера й заступників). */
    public function familyEvent(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'familyId' => ['required', 'integer'],
            'startsAt' => ['required', 'date', 'after:now'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $title = $this->title($id);
        $me = $request->user();
        if (! class_exists(\Addons\FamilyEvents\Models\FamilyEvent::class)) {
            Social::fail(501, 'Події родини недоступні');
        }
        if (! FamilyContext::isManager($me, (int) $data['familyId']) && ! $me->can('families.manage')) {
            Social::fail(403, 'Запланувати перегляд може лідер або заступник родини');
        }

        $event = FamilyContext::run((int) $data['familyId'], function () use ($title, $data, $me) {
            $event = \Addons\FamilyEvents\Models\FamilyEvent::create([
                'title' => 'Кіновечір: '.$title->name,
                'description' => trim(($data['note'] ?? '')."\n\nФільм: ".url('/cinema/title/'.$title->id)),
                'location' => 'GameConnect · Кіно',
                'starts_at' => Carbon::parse($data['startsAt']),
                'created_by' => $me->id,
            ]);
            \Illuminate\Support\Facades\Event::dispatch(new \Addons\FamilyEvents\Events\FamilyEventCreated($event));

            return $event;
        });

        return response()->json(['id' => $event->id, 'startsAt' => $event->starts_at->toIso8601String()], 201);
    }

    public function person(Request $request, int $id): JsonResponse
    {
        $person = Person::query()->find($id);
        if (! $person) {
            Social::fail(404, 'Людину не знайдено');
        }
        if (! $person->details_loaded_at && Tmdb::configured()) {
            try {
                $person = Importer::loadPerson($person);
            } catch (\Throwable) {
            }
        }

        return response()->json(CinemaPresenter::person($person));
    }

    /** Розділ «Кіно» у профілі людини: оцінки й «хочу подивитись». */
    public function userCinema(Request $request, int $userId): JsonResponse
    {
        if (! User::query()->whereKey($userId)->exists()) {
            Social::fail(404, 'Користувача не знайдено');
        }
        $reviews = DB::table('cinema_reviews')->where('user_id', $userId)->orderByDesc('updated_at')->limit(30)->get();
        $titles = Title::query()->published()->with('genres')->whereIn('id', $reviews->pluck('title_id'))->get()->keyBy('id');
        $wantIds = DB::table('cinema_watchlist')->where('user_id', $userId)->orderByDesc('created_at')->limit(18)->pluck('title_id');

        return response()->json([
            'ratings' => $reviews->filter(fn ($r) => isset($titles[$r->title_id]))->map(fn ($r) => CinemaPresenter::card($titles[$r->title_id]) + ['myRating' => (int) $r->rating])->values(),
            'watchlist' => CinemaPresenter::cards(Title::query()->published()->with('genres')->whereIn('id', $wantIds)->get()),
            'ratedCount' => DB::table('cinema_reviews')->where('user_id', $userId)->count(),
        ]);
    }

    private function recount(Title $title): void
    {
        $stats = DB::table('cinema_reviews')->where('title_id', $title->id)->selectRaw('AVG(rating) as a, COUNT(*) as c')->first();
        $title->update(['local_rating' => $stats->c ? round((float) $stats->a, 1) : null, 'local_rating_count' => (int) $stats->c]);
    }
}
