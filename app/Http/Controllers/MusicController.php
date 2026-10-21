<?php

namespace App\Http\Controllers;

use App\Models\Playlist;
use App\Models\Track;
use App\Models\User;
use App\Services\MusicService;
use App\Services\Spotify\SpotifyClient;
use App\Support\Settings\SiteSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MusicController extends Controller
{
    public const PER_PAGE = 30;

    public const TABS = ['mine', 'discover', 'playlists', 'spotify'];

    public function __construct(
        private readonly MusicService $music,
        private readonly SpotifyClient $spotify,
    ) {}

    public function index(Request $request, SiteSettings $settings): Response
    {
        $user = $request->user();
        $data = $request->validate([
            'tab' => ['nullable', Rule::in(self::TABS)],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $tab = $data['tab'] ?? 'mine';
        $q = trim($data['q'] ?? '');

        $query = match ($tab) {
            'discover' => Track::query()->search($q)->orderByDesc($q === '' ? 'plays_count' : 'id')->orderByDesc('id'),
            default => $user->library()->search($q)->orderByPivot('created_at', 'desc')->orderByDesc('tracks.id'),
        };

        $tracks = $query->paginate(self::PER_PAGE)->withQueryString();
        $tracks->setCollection(collect($this->music->cards($tracks->getCollection(), $user)));

        $account = $user->spotifyAccount;

        return Inertia::render('music/index', [
            'tab' => $tab,
            'q' => $q,
            'tracks' => Inertia::scroll(fn () => $tracks),
            'playlists' => $this->playlistCards($user->playlists()),
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
                'formats' => Track::AUDIO_MIMES,
            ],
        ]);
    }

    public function user(Request $request, User $user): Response
    {
        $viewer = $request->user();
        abort_if($user->isBanned() && ! $viewer->isStaff(), 404);

        $tracks = $user->library()->orderByPivot('created_at', 'desc')->orderByDesc('tracks.id')->paginate(self::PER_PAGE);
        $tracks->setCollection(collect($this->music->cards($tracks->getCollection(), $viewer)));

        return Inertia::render('music/user', [
            'owner' => $user->toCard(),
            'tracks' => Inertia::scroll(fn () => $tracks),
            'total' => $user->library()->count(),
            'playlists' => $this->playlistCards($user->playlists()->when($viewer->isNot($user), fn (Builder $q) => $q->where('is_public', true))),
            'nowPlaying' => Inertia::defer(fn () => $this->music->currentFor($user, $viewer)),
        ]);
    }

    public function search(Request $request): JsonResponse|Response
    {
        // Відкриття сторінкою (вкладка «Пошук») — сторінка розділу; запит із вибору треку — JSON.
        if ($request->header('X-Inertia') || ! $request->wantsJson()) {
            return app(MusicHubController::class)->search($request);
        }
        $user = $request->user();
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'scope' => ['nullable', Rule::in(['mine', 'all'])],
        ]);

        $query = ($data['scope'] ?? 'mine') === 'all'
            ? Track::query()->search($data['q'] ?? null)->orderByDesc('plays_count')
            : $user->library()->search($data['q'] ?? null)->orderByPivot('created_at', 'desc');

        return response()->json(['tracks' => $this->music->cards($query->limit(30)->get(), $user)]);
    }

    /**
     * @param  Builder<Playlist>|HasMany<Playlist, User>  $query
     * @return list<array<string, mixed>>
     */
    private function playlistCards($query): array
    {
        return array_values($query
            ->with(['tracks' => fn (Relation $q) => $q->whereNotNull('cover_path')->limit(4)])
            ->latest('updated_at')
            ->get()
            ->map(fn (Playlist $p) => $p->toCard())
            ->all());
    }
}
