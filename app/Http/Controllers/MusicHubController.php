<?php

namespace App\Http\Controllers;

use App\Models\Track;
use App\Services\Music\ArtistInfo;
use App\Services\Music\MusicCatalog;
use App\Services\MusicService;
use App\Services\Spotify\SpotifyClient;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Розділ «Музика» в стилі Apple Music: Головна, Нове, Радіо, Медіатека, Пошук,
 * сторінки виконавця, альбому, міксу, жанру, чартів і Replay. Дані — MusicCatalog.
 */
class MusicHubController extends Controller
{
    /** Розділи медіатеки (як у Apple Music: плейлисти, виконавці, альбоми, пісні, жанри + наші). */
    public const LIBRARY_SECTIONS = ['playlists', 'artists', 'albums', 'songs', 'favorites', 'genres', 'spotify'];

    /** Старі вкладки ?tab=… ведуть у нові розділи. */
    private const OLD_TABS = [
        'mine' => '/music/library/songs',
        'discover' => '/music/new',
        'playlists' => '/music/library/playlists',
        'spotify' => '/music/library/spotify',
    ];

    public function __construct(
        private readonly MusicCatalog $catalog,
        private readonly MusicService $music,
    ) {}

    public function home(Request $request): Response|RedirectResponse
    {
        $tab = $request->query('tab');
        if (is_string($tab) && isset(self::OLD_TABS[$tab])) {
            return redirect(self::OLD_TABS[$tab]);
        }

        return Inertia::render('music/home', [
            'home' => $this->catalog->home($request->user()),
        ]);
    }

    public function newest(Request $request): Response
    {
        return Inertia::render('music/new', ['data' => $this->catalog->newest($request->user())]);
    }

    public function radio(Request $request): Response
    {
        return Inertia::render('music/radio', ['data' => $this->catalog->radio($request->user())]);
    }

    public function library(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('music/library', [
            'data' => $this->catalog->library($user),
            // Які розділи людина бачить у медіатеці (кнопка «Змінити»).
            'sections' => $this->visibleSections($user->pref('music_library_sections')),
        ]);
    }

    public function librarySection(Request $request, string $section, SpotifyClient $spotify): Response
    {
        abort_unless(in_array($section, self::LIBRARY_SECTIONS, true), 404);
        $user = $request->user();

        $items = match ($section) {
            'playlists' => $this->catalog->libraryPlaylists($user),
            'artists' => $this->catalog->libraryArtists($user),
            'albums' => $this->catalog->libraryAlbums($user),
            'genres' => $this->catalog->libraryGenres($user),
            default => [],
        };

        $songs = null;
        if (in_array($section, ['songs', 'favorites'], true)) {
            $data = $request->validate([
                'sort' => ['nullable', Rule::in(['added', 'title', 'artist', 'plays'])],
                'q' => ['nullable', 'string', 'max:100'],
            ]);
            $sort = $data['sort'] ?? 'added';
            $query = $user->library()->where('tracks.processing', false)->search($data['q'] ?? null);
            // when() тут не годиться: у замиканні — звичайний Builder, без wherePivot.
            if ($section === 'favorites') {
                $query->wherePivot('is_favorite', true);
            }
            $query = match ($sort) {
                'title' => $query->orderBy('tracks.title'),
                'artist' => $query->orderBy('tracks.artist')->orderBy('tracks.album')->orderBy('tracks.track_no'),
                'plays' => $query->orderByDesc('tracks.plays_count'),
                default => $query->orderByPivot('created_at', 'desc')->orderByDesc('tracks.id'),
            };
            $page = $query->paginate(MusicController::PER_PAGE)->withQueryString();
            $page->setCollection(collect($this->music->cards($page->getCollection(), $user)));
            $songs = Inertia::scroll(fn () => $page);
        }

        return Inertia::render('music/library-section', [
            'section' => $section,
            'items' => $items,
            'songs' => $songs,
            'sort' => $request->query('sort', 'added'),
            'q' => (string) $request->query('q', ''),
            'spotify' => $section === 'spotify' ? [
                'configured' => $spotify->configured(),
                'account' => $user->spotifyAccount?->toCard(),
            ] : null,
        ]);
    }

    public function sections(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'sections' => ['array'],
            'sections.*' => ['string', Rule::in(self::LIBRARY_SECTIONS)],
        ]);
        $request->user()->mergePref(['music_library_sections' => array_values(array_unique($data['sections'] ?? []))]);

        return back();
    }

    public function search(Request $request): Response
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'scope' => ['nullable', Rule::in(['all', 'library'])],
        ]);
        $q = trim($data['q'] ?? '');
        $scope = $data['scope'] ?? 'all';

        return Inertia::render('music/search', [
            'q' => $q,
            'scope' => $scope,
            'results' => $q === '' ? null : $this->catalog->search($request->user(), $q, $scope),
            'categories' => $this->catalog->genres(24),
        ]);
    }

    public function artist(Request $request): Response
    {
        $name = trim((string) $request->query('name', ''));
        abort_if($name === '' || mb_strlen($name) > 150, 404);
        // Виконавця може не бути в нашому каталозі (трек зі Spotify) — тоді сторінка лише з «Про виконавця».
        $artist = $this->catalog->artist($request->user(), $name) ?? $this->catalog->emptyArtist($name);

        return Inertia::render('music/artist', ['artist' => $artist]);
    }

    /** «Про виконавця»: фото, опис, місто, дати — окремим запитом, бо джерела зовнішні й повільні. */
    public function artistInfo(Request $request, ArtistInfo $info): JsonResponse
    {
        $name = $request->validate(['name' => ['required', 'string', 'max:150']])['name'];

        return response()->json(['info' => $info->get(trim($name))]);
    }

    public function album(Request $request): Response
    {
        $album = $this->catalog->album($request->user(), (string) $request->query('artist', ''), (string) $request->query('title', ''));
        abort_if($album === null, 404);

        return Inertia::render('music/album', ['album' => $album]);
    }

    public function mix(Request $request, string $key): Response
    {
        $mix = $this->catalog->mix($request->user(), $key);
        abort_if($mix === null, 404);

        return Inertia::render('music/mix', $mix);
    }

    public function genre(Request $request): Response
    {
        $name = trim((string) $request->query('name', ''));
        abort_if($name === '' || ! Track::query()->ready()->where('genre', $name)->exists(), 404);

        return Inertia::render('music/genre', ['genre' => $this->catalog->genre($request->user(), $name)]);
    }

    public function charts(Request $request): Response
    {
        return Inertia::render('music/charts', ['charts' => $this->catalog->charts($request->user())]);
    }

    public function replay(Request $request, ?int $year = null): Response
    {
        $year ??= CarbonImmutable::now()->year;
        abort_if($year < 2020 || $year > CarbonImmutable::now()->year, 404);

        return Inertia::render('music/replay', ['replay' => $this->catalog->replay($request->user(), $year)]);
    }

    /** Наступна порція нескінченної станції чи автовідтворення (∞) після кінця черги. */
    public function station(Request $request): JsonResponse
    {
        $data = $request->validate([
            'key' => ['required', 'string', 'max:120', 'regex:/^(me|genre:.+|artist:.+|track:\d+)$/u'],
            'exclude' => ['array', 'max:500'],
            'exclude.*' => ['integer'],
        ]);

        return response()->json(['tracks' => $this->catalog->station($request->user(), $data['key'], array_values(array_map('intval', $data['exclude'] ?? [])))]);
    }

    /** Плейлисти, куди людина може додати трек (меню «…» → «Додати в плейлист»). */
    public function myPlaylists(Request $request): JsonResponse
    {
        return response()->json(['playlists' => $this->catalog->libraryPlaylistsQuery($request->user())
            ->latest('updated_at')->limit(200)->get(['id', 'title', 'cover_path'])
            ->map(fn ($p) => ['id' => $p->id, 'title' => $p->title, 'cover_url' => $p->cover_url])->values()->all()]);
    }

    /** Зірочка «Улюблене»: трек додається в медіатеку й позначається улюбленим. */
    public function favorite(Request $request, Track $track): JsonResponse
    {
        $user = $request->user();
        $this->music->add($user, $track);
        DB::table('music_library')->where('user_id', $user->id)->where('track_id', $track->id)->update(['is_favorite' => true]);

        return response()->json(['favorite' => true, 'in_library' => true]);
    }

    /** Зняти зірочку: трек лишається в медіатеці. */
    public function unfavorite(Request $request, Track $track): JsonResponse
    {
        $user = $request->user();
        DB::table('music_library')->where('user_id', $user->id)->where('track_id', $track->id)->update(['is_favorite' => false]);

        return response()->json([
            'favorite' => false,
            'in_library' => DB::table('music_library')->where('user_id', $user->id)->where('track_id', $track->id)->exists(),
        ]);
    }

    /**
     * @return list<string>
     */
    private function visibleSections(mixed $saved): array
    {
        $saved = is_array($saved) ? array_values(array_intersect($saved, self::LIBRARY_SECTIONS)) : [];

        return $saved !== [] ? $saved : ['playlists', 'artists', 'albums', 'songs', 'favorites', 'genres', 'spotify'];
    }
}
