<?php

namespace App\Http\Controllers\Api;

use App\Cinema\Genre;
use App\Cinema\Title;
use App\Cinema\Tmdb;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Validator;

/**
 * Міст для нативного CineCon (переробленого Flixy) — ті самі маршрути й
 * форма відповіді, що очікує вбудований у застосунок RetrofitService
 * (fetchSettings, fetchHomePageData, fetchContentsByGenre,
 * fetchContentDetails, searchContent), але дані беруться з нашого
 * власного каталогу кінопорталу (cinema_titles/cinema_genres), а не з
 * оригінального Flixy-бекенду.
 *
 * Свідомо НЕ реалізовано тут: content_sources завжди порожній. Kodik і
 * FlixCDN — це iframe-плеєри для веб-вбудовування, а не прямі
 * посилання на потік (m3u8/mp4), яких очікує нативний ExoPlayer
 * застосунку (SourceItem.type підтримує лише youtube/m3u8/file).
 * Щоб відео реально програвалось у CineCon, треба або переробити
 * PlayerNewActivity під WebView з ембедом, або діставати прямий потік
 * з Kodik/FlixCDN (крихко й поза призначенням цих сервісів) — це
 * окреме архітектурне рішення, ще не ухвалене.
 */
class FlixyBridgeController extends Controller
{
    public function fetchSettings(): JsonResponse
    {
        $genres = Genre::orderBy('name')->get()->map(fn (Genre $g) => [
            'id' => $g->id,
            'title' => $g->name,
        ]);

        return response()->json([
            'status' => true,
            'message' => 'Fetch Setting Successfully',
            'setting' => [
                'id' => 1,
                'app_name' => 'CineCon',
                'privacy_url' => '',
                'terms_url' => '',
                'more_apps_url' => '',
                'is_live_tv_enable' => 0,
                'is_admob_android' => 0,
                'is_custom_android' => 0,
                'videoad_skip_time' => 5,
            ],
            'genres' => $genres,
            'languages' => [],
            'admob' => [],
        ]);
    }

    public function fetchHomePageData(Request $request): JsonResponse
    {
        if ($error = $this->validationError($request, ['user_id' => 'required'])) {
            return $error;
        }

        $featured = Title::published()->where('is_featured', true)->limit(10)->get();
        $topContents = Title::published()->orderByDesc('popularity')->limit(10)->get();

        $genreContents = Genre::orderBy('name')->get()->map(function (Genre $genre) {
            $titles = Title::published()
                ->whereHas('genres', fn ($q) => $q->where('cinema_genres.id', $genre->id))
                ->inRandomOrder()
                ->limit(15)
                ->get();

            return $titles->isEmpty() ? null : [
                'id' => $genre->id,
                'title' => $genre->name,
                'contents' => $titles->map($this->mapTitle(...)),
            ];
        })->filter()->values();

        return response()->json([
            'status' => true,
            'message' => 'Fetch Home Page Data Successfully',
            'featured' => $featured->map($this->mapTitle(...)),
            // Персональний watchlist з'явиться, коли буде міст акаунтів
            // Flixy-реєстрації з нашими users — поки що завжди порожній.
            'watchlist' => [],
            'topContents' => $topContents->values()->map(fn (Title $t, int $i) => [
                'id' => $i + 1,
                'content_index' => $i,
                'content_id' => $t->id,
                'content' => $this->mapTitle($t),
            ]),
            'genreContents' => $genreContents,
        ]);
    }

    public function fetchContentsByGenre(Request $request): JsonResponse
    {
        if ($error = $this->validationError($request, ['genre_id' => 'required', 'start' => 'required', 'limit' => 'required'])) {
            return $error;
        }

        $genre = Genre::find($request->integer('genre_id'));
        if (! $genre) {
            return response()->json(['status' => false, 'message' => 'Genre Not Found']);
        }

        $titles = Title::published()
            ->whereHas('genres', fn ($q) => $q->where('cinema_genres.id', $genre->id))
            ->skip($request->integer('start'))
            ->take($request->integer('limit'))
            ->get();

        return response()->json([
            'status' => true,
            'message' => 'Fetch Contents By Genre',
            'data' => $titles->map($this->mapTitle(...)),
        ]);
    }

    public function searchContent(Request $request): JsonResponse
    {
        if ($error = $this->validationError($request, ['start' => 'required', 'limit' => 'required'])) {
            return $error;
        }

        $query = Title::published()->orderByDesc('created_at');

        if ($request->filled('type')) {
            $query->where('type', $request->integer('type') === 2 ? 'series' : 'movie');
        }
        if ($request->filled('genre_id')) {
            $genreId = $request->integer('genre_id');
            $query->whereHas('genres', fn ($q) => $q->where('cinema_genres.id', $genreId));
        }
        if ($request->filled('keyword')) {
            $query->where('name', 'like', '%'.$request->string('keyword').'%');
        }

        $titles = $query->skip($request->integer('start'))->take($request->integer('limit'))->get();

        return response()->json([
            'status' => true,
            'message' => 'Content Result',
            'data' => $titles->map($this->mapTitle(...)),
        ]);
    }

    public function fetchContentDetails(Request $request): JsonResponse
    {
        if ($error = $this->validationError($request, ['content_id' => 'required'])) {
            return $error;
        }

        $title = Title::published()->with(['genres', 'seasons.episodes'])->find($request->integer('content_id'));
        if (! $title) {
            return response()->json(['status' => false, 'message' => 'Content Not Found']);
        }

        $data = $this->mapTitle($title);

        $moreLikeThis = Title::published()
            ->whereHas('genres', function ($q) use ($title) {
                $q->whereIn('cinema_genres.id', $title->genres->pluck('id'));
            })
            ->where('id', '!=', $title->id)
            ->inRandomOrder()
            ->limit(10)
            ->get();
        if ($moreLikeThis->isEmpty()) {
            $moreLikeThis = Title::published()->where('type', $title->type)->where('id', '!=', $title->id)->inRandomOrder()->limit(10)->get();
        }
        $data['more_like_this'] = $moreLikeThis->map($this->mapTitle(...));

        if ($title->isSeries()) {
            $data['seasons'] = $title->seasons->map(fn ($season) => [
                'id' => $season->id,
                'season_number' => $season->number,
                'episode' => $season->episodes->map(fn ($ep) => [
                    'id' => $ep->id,
                    'title' => $ep->name ?: "Серія {$ep->number}",
                    'description' => $ep->overview ?? '',
                    'thumbnail' => Tmdb::image($ep->still_path, 'w300') ?? '',
                    // Немає прямого потоку (див. коментар класу) — джерела порожні.
                    'source' => [],
                ]),
            ]);
        }

        return response()->json([
            'status' => true,
            'message' => 'Fetch Content Successfully',
            'data' => $data,
        ]);
    }

    /** @return array<string, mixed> */
    private function mapTitle(Title $title): array
    {
        return [
            'id' => $title->id,
            'title' => $title->name,
            'description' => $title->overview ?? '',
            'type' => $title->isSeries() ? 2 : 1,
            'duration' => $title->runtime ? $title->runtime.' min' : '',
            'release_year' => $title->year ?? 0,
            'ratings' => (float) ($title->local_rating ?? $title->vote_average ?? 0),
            'language_id' => 0,
            'download_link' => '',
            'trailer_url' => $title->trailer_key ? 'https://www.youtube.com/watch?v='.$title->trailer_key : '',
            'vertical_poster' => Tmdb::image($title->poster_path, 'w500') ?? '',
            'horizontal_poster' => Tmdb::image($title->backdrop_path, 'w780') ?? '',
            'genre_ids' => $title->relationLoaded('genres')
                ? $title->genres->pluck('id')->implode(',')
                : $title->genres()->pluck('cinema_genres.id')->implode(','),
            'is_featured' => $title->is_featured ? 1 : 0,
            'total_download' => 0,
            'total_share' => 0,
            'total_view' => $title->vote_count ?? 0,
            'actor_ids' => '',
            'is_watchlist' => false,
            'contentCast' => [],
            // Завжди порожньо — див. коментар класу вище (немає прямого потоку).
            'content_sources' => [],
            'content_subtitles' => [],
        ];
    }

    /** @param  array<string, string>  $rules */
    private function validationError(Request $request, array $rules): ?JsonResponse
    {
        /** @var Validator $validator */
        $validator = validator($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json(['status' => false, 'message' => $validator->errors()->first()]);
        }

        return null;
    }
}
