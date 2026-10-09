<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\PhotoController;
use App\Http\Controllers\SpotifyController;
use App\Http\Controllers\TrackController;
use App\Models\Movie;
use App\Models\Photo;
use App\Models\PhotoAlbum;
use App\Models\Playlist;
use App\Models\Track;
use App\Models\User;
use App\Services\Cinema\CinemaService;
use App\Services\MusicService;
use App\Services\PhotoService;
use App\Services\Spotify\SpotifyClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MediaApiController extends ApiController
{
    public function __construct(
        private readonly PhotoService $photos,
        private readonly MusicService $music,
        private readonly CinemaService $cinema,
        private readonly SpotifyClient $spotify,
    ) {}

    public function photos(Request $request, User $user): JsonResponse
    {
        $viewer = $this->user($request);
        abort_if($user->isBanned() && ! $viewer->isStaff(), 404);

        $albums = $this->photos->visibleAlbums($user, $viewer)->with('cover')->get()
            ->map(fn (PhotoAlbum $album) => $this->photos->albumCard($album))
            ->values();

        return response()->json([
            'owner' => $user->toCard(),
            'albums' => $albums,
        ]);
    }

    public function storeAlbum(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:1', 'max:80'],
            'description' => ['nullable', 'string', 'max:500'],
            'privacy' => ['required', Rule::in(PhotoAlbum::PRIVACIES)],
        ]);
        abort_unless($this->photos->canCreateAlbum($user, $user), 403);

        $album = $this->photos->createAlbum($user, [
            'title' => trim($data['title']),
            'description' => isset($data['description']) ? (trim((string) $data['description']) ?: null) : null,
            'privacy' => $data['privacy'],
            'comments_enabled' => true,
        ]);

        return response()->json(['album' => $this->photos->albumCard($album)], 201);
    }

    public function uploadPhotos(Request $request, PhotoAlbum $album, SiteSettings $settings): JsonResponse
    {
        $user = $this->user($request);
        abort_unless($this->photos->canUpload($album, $user), 403);

        $request->validate([
            'photos' => ['required', 'array', 'max:30'],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp,gif', 'max:'.(int) $settings->get('max_upload_mb') * 1024],
        ], [
            'photos.max' => 'За раз можна завантажити до 30 фото.',
        ]);

        $created = $this->photos->upload($album, $user, array_values($request->file('photos', [])));

        return response()->json(['count' => count($created)], 201);
    }

    public function album(Request $request, PhotoAlbum $album): JsonResponse
    {
        $viewer = $this->user($request);
        abort_unless($this->photos->canView($album, $viewer), 404);

        $page = $album->photos()->latest('id')->paginate(30);

        return response()->json([
            'album' => $this->photos->albumCard($album),
            'photos' => $this->page($page, $page->getCollection()->map(fn (Photo $photo) => [
                ...$photo->toThumb(),
                'caption' => $photo->caption,
            ])->values()->all()),
            'can_upload' => $this->photos->canUpload($album, $viewer),
        ]);
    }

    public function photo(Request $request, Photo $photo): JsonResponse
    {
        return app(PhotoController::class)->show($request, $photo);
    }

    public function likePhoto(Request $request, Photo $photo): JsonResponse
    {
        $album = $photo->album;
        abort_unless($this->photos->canView($album, $this->user($request)), 404);
        $liked = $this->photos->toggleLike($photo, $this->user($request));

        return response()->json(['liked' => $liked, 'likes_count' => $photo->fresh()?->likes_count]);
    }

    public function music(Request $request, SiteSettings $settings): JsonResponse
    {
        $user = $this->user($request);
        $tab = in_array($request->query('tab'), ['mine', 'discover', 'playlists', 'spotify'], true) ? (string) $request->query('tab') : 'mine';
        $q = trim((string) $request->query('q', ''));

        $query = match ($tab) {
            'discover' => Track::query()->search($q)->orderByDesc($q === '' ? 'plays_count' : 'id')->orderByDesc('id'),
            default => $user->library()->search($q)->orderByPivot('created_at', 'desc')->orderByDesc('tracks.id'),
        };

        $tracks = $query->paginate(30);
        $rows = [];
        foreach ($tracks->getCollection() as $track) {
            $rows[] = $track;
        }
        $account = $user->spotifyAccount;

        return response()->json([
            'tab' => $tab,
            'tracks' => $this->page($tracks, $this->music->cards(collect($rows), $user)),
            'playlists' => $user->playlists()->latest('id')->get()->map(fn (Playlist $playlist) => $playlist->toCard())->values(),
            'stats' => [
                'tracks' => $user->library()->count(),
                'duration' => (int) $user->library()->sum('duration'),
                'playlists' => $user->playlists()->count(),
            ],
            'spotify' => [
                'configured' => $this->spotify->configured(),
                'account' => $account?->toCard(),
            ],
            'limits' => [
                'max_mb' => (int) $settings->get('music_max_track_mb'),
            ],
        ]);
    }

    public function addTrack(Request $request, Track $track): JsonResponse
    {
        $added = $this->music->add($this->user($request), $track);

        return response()->json(['in_library' => true, 'added' => $added]);
    }

    public function removeTrack(Request $request, Track $track): JsonResponse
    {
        $this->music->remove($this->user($request), $track);

        return response()->json(['in_library' => false]);
    }

    public function playlist(Request $request, Playlist $playlist): JsonResponse
    {
        $viewer = $this->user($request);
        abort_unless($this->music->canViewPlaylist($playlist, $viewer), 404);
        $playlist->load('tracks');
        $rows = [];
        foreach ($playlist->tracks as $track) {
            $rows[] = $track;
        }

        return response()->json([
            'playlist' => $playlist->toCard(),
            'tracks' => $this->music->cards(collect($rows), $viewer),
        ]);
    }

    public function storePlaylist(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:300'],
            'is_public' => ['sometimes', 'boolean'],
        ]);
        $playlist = $this->music->createPlaylist($this->user($request), [
            'title' => trim($data['title']),
            'description' => isset($data['description']) ? (trim((string) $data['description']) ?: null) : null,
            'is_public' => (bool) ($data['is_public'] ?? false),
        ]);

        return response()->json(['playlist' => $playlist->toCard()], 201);
    }

    public function storeTrack(Request $request, SiteSettings $settings): JsonResponse
    {
        return app(TrackController::class)->store($request, $settings);
    }

    public function nowPlaying(Request $request): JsonResponse
    {
        $data = $request->validate(['track_id' => ['nullable', 'integer']]);
        $user = $this->user($request);
        $track = isset($data['track_id']) ? Track::query()->whereKey($data['track_id'])->first() : null;
        $track ? $this->music->nowPlaying($user, $track) : $this->music->stop($user);

        return response()->json(['now' => $this->music->currentFor($user, $user)]);
    }

    public function spotifyStart(Request $request): JsonResponse
    {
        abort_unless($this->spotify->configured(), 422, 'Адміністратор ще не налаштував Spotify.');
        $state = Str::random(40);
        Cache::put('spotify.oauth.'.$state, [
            'state' => $state,
            'user_id' => $this->user($request)->id,
        ], now()->addMinutes(10));

        return response()->json(['url' => $this->spotify->authorizeUrl($state)]);
    }

    public function spotifyDisconnect(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $user->spotifyAccount()->delete();
        Cache::forget('music.now.'.$user->id);

        return response()->json(['ok' => true]);
    }

    public function spotifyLibrary(Request $request, string $section, SpotifyController $spotify): JsonResponse
    {
        return $spotify->library($request, $section);
    }

    public function cinema(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'type' => ['nullable', Rule::in(array_keys(Movie::TYPES))],
            'genre' => ['nullable', 'string', 'max:60'],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', Rule::in(['new', 'popular', 'rating', 'year'])],
        ]);
        $sort = $filters['sort'] ?? 'new';

        $catalog = Movie::query()->published()
            ->search($filters['q'] ?? null)
            ->when($filters['type'] ?? null, fn (Builder $q, string $type) => $q->where('type', $type))
            ->when($filters['genre'] ?? null, fn (Builder $q, string $genre) => $q->whereJsonContains('genres', $genre));

        match ($sort) {
            'popular' => $catalog->orderByDesc('views_count'),
            'rating' => $catalog->orderByRaw('coalesce(rating_imdb, rating_tmdb, rating_shikimori, 0) desc'),
            'year' => $catalog->orderByDesc('year'),
            default => $catalog->orderByDesc('created_at'),
        };

        $page = $catalog->orderByDesc('id')->paginate(24);
        $user = $this->user($request);

        return response()->json([
            'movies' => $this->page($page, $page->getCollection()->map(fn (Movie $movie) => $movie->toCard())->values()->all()),
            'types' => collect(Movie::TYPES)->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values(),
            'continue' => $this->list($user, 'watching'),
            'popular' => Movie::query()->published()->orderByDesc('views_count')->limit(12)->get()->map(fn (Movie $m) => $m->toCard())->values(),
        ]);
    }

    public function movie(Request $request, Movie $movie): JsonResponse
    {
        $viewer = $this->user($request);
        abort_unless($movie->is_published || $viewer->isStaff(), 404);
        $movie->load('sources');
        if (Cache::add('cinema.api.view.'.$movie->id.'.'.$viewer->id, true, now()->addHour())) {
            $movie->increment('views_count');
        }

        return response()->json([
            'movie' => [
                ...$movie->toCard(),
                'description' => $movie->description,
                'genres' => $movie->genres ?? [],
                'backdrop' => $movie->backdrop,
            ],
            'players' => $this->cinema->players($movie),
            'state' => $this->cinema->stateFor($movie, $viewer),
            'statuses' => Movie::STATUSES,
        ]);
    }

    public function movieStatus(Request $request, Movie $movie): JsonResponse
    {
        abort_unless($movie->is_published, 404);
        $data = $request->validate(['status' => ['nullable', Rule::in(array_keys(Movie::STATUSES))]]);
        $this->cinema->setStatus($this->user($request), $movie, $data['status'] ?? null);

        return response()->json(['state' => $this->cinema->stateFor($movie, $this->user($request))]);
    }

    public function movieRate(Request $request, Movie $movie): JsonResponse
    {
        abort_unless($movie->is_published, 404);
        $data = $request->validate(['rating' => ['nullable', 'integer', 'min:1', 'max:10']]);
        $this->cinema->rate($this->user($request), $movie, isset($data['rating']) ? (int) $data['rating'] : null);

        return response()->json(['state' => $this->cinema->stateFor($movie, $this->user($request))]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function list(User $user, string $status): array
    {
        $ids = DB::table('movie_user')->where('user_id', $user->id)->where('status', $status)->pluck('movie_id');

        return array_values(Movie::query()->published()->whereIn('id', $ids)->limit(12)->get()
            ->map(fn (Movie $movie) => $movie->toCard())
            ->all());
    }
}
