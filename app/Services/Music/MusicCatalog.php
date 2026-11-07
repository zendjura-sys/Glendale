<?php

namespace App\Services\Music;

use App\Models\MusicStatus;
use App\Models\Playlist;
use App\Models\RadioStation;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\MusicService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Каталог розділу «Музика» в стилі Apple Music: Головна (мікси, нещодавно прослухане, Replay),
 * Нове (новинки, чарти, настрої, жанри), Радіо (станції й нескінченні потоки), Медіатека (плейлисти,
 * виконавці, альбоми, пісні, жанри), Пошук і сторінки виконавця й альбому.
 * Виконавець і альбом — це назви з тегів треків: окремих таблиць немає.
 */
class MusicCatalog
{
    /** Скільки треків у міксі й у порції нескінченної станції. */
    private const MIX_SIZE = 25;

    private const STATION_BATCH = 20;

    /** Мікси «Для тебе»: ключ → кольори обкладинки (градієнт, як у Apple Music). */
    public const MIXES = [
        // Кольори проєкту: неоновий синій, блакить, лід — без «райдуги».
        'favorites' => ['#2f7bff', '#1a2f7a'],
        'discovery' => ['#3d63ff', '#0b1638'],
        'new' => ['#22c4f0', '#2a6cff'],
        'friends' => ['#4d9bff', '#123a8c'],
        'chill' => ['#a9c8ff', '#2f7bff'],
    ];

    /** Жанри, з яких складається «Мікс для відпочинку». */
    private const CHILL_GENRES = ['lo-fi', 'lofi', 'chill', 'ambient', 'jazz', 'acoustic', 'classical', 'soul', 'r&b', 'downtempo'];

    public function __construct(
        private readonly MusicService $music,
        private readonly FriendshipService $friends,
        private readonly ArtistInfo $artistInfo,
    ) {}

    // ───────────────────────── Головна ─────────────────────────

    /**
     * @return array<string, mixed>
     */
    public function home(User $user): array
    {
        $mixes = $this->mixCards($user);

        return [
            'top_picks' => [$this->myStationCard($user), ...array_slice($mixes, 0, 3)],
            'recently_played' => $this->recentlyPlayed($user, 12),
            'made_for_you' => $mixes,
            'replay' => [
                'year' => CarbonImmutable::now()->year,
                'tracks' => $this->cards($this->topPlayed($user, CarbonImmutable::now()->startOfYear(), 5), $user),
            ],
            'friends' => $this->friendsListening($user),
            'stations' => array_slice($this->genreStations(), 0, 8),
        ];
    }

    /**
     * Що зараз слухають друзі (наша функція «Зараз грає» в профілі).
     *
     * @return list<array<string, mixed>>
     */
    public function friendsListening(User $user): array
    {
        $ids = $this->listeningFriendIds($user);
        if ($ids === []) {
            return [];
        }

        return array_values(MusicStatus::query()->whereIn('user_id', $ids)->where('expires_at', '>', now())
            ->where('source', 'local')->whereNotNull('track_id')->with(['user', 'track'])
            ->latest('updated_at')->limit(12)->get()
            ->filter(fn (MusicStatus $s) => $s->user !== null && $s->track !== null)
            ->map(fn (MusicStatus $s) => ['user' => $s->user->toCard(), 'track' => $s->track->toCard()])
            ->all());
    }

    /**
     * Друзі, які не вимкнули «Показувати, що я слухаю».
     *
     * @return list<int>
     */
    private function listeningFriendIds(User $user): array
    {
        $ids = $this->friends->friendIds($user);
        if ($ids === []) {
            return [];
        }
        $hidden = User::query()->whereIn('id', $ids)->where('preferences->show_listening', false)
            ->pluck('id')->map(fn ($id) => (int) $id)->all();

        return array_values(array_diff($ids, $hidden));
    }

    /**
     * Нещодавно прослухані треки (свої треки GameCon), без повторів.
     *
     * @return list<array<string, mixed>>
     */
    public function recentlyPlayed(User $user, int $limit): array
    {
        $ids = DB::table('music_plays')->where('user_id', $user->id)->whereNotNull('track_id')
            ->groupBy('track_id')->selectRaw('track_id, MAX(played_at) as last')
            ->orderByDesc('last')->limit($limit)->pluck('track_id')->map(fn ($id) => (int) $id)->all();

        return $this->cards($this->ordered(array_values($ids)), $user);

    }

    // ───────────────────────── Мікси ─────────────────────────

    /**
     * @return list<array<string, mixed>>
     */
    public function mixCards(User $user): array
    {
        $cards = [];
        foreach (self::MIXES as $key => $colors) {
            $tracks = $this->mixTracks($user, $key, 4);
            if ($tracks->isEmpty()) {
                continue;
            }
            $cards[] = [
                'kind' => 'mix',
                'key' => $key,
                'colors' => $colors,
                'covers' => $tracks->pluck('cover_url')->filter()->values()->all(),
                'href' => '/music/mix/'.$key,
            ];
        }

        return $cards;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function mix(User $user, string $key): ?array
    {
        if (! isset(self::MIXES[$key])) {
            return null;
        }
        $card = collect($this->mixCards($user))->firstWhere('key', $key);
        if ($card === null) {
            return null;
        }

        return ['mix' => $card, 'tracks' => $this->cards($this->mixTracks($user, $key, self::MIX_SIZE), $user)];
    }

    /**
     * Треки міксу. Склад оновлюється раз на тиждень (кеш до понеділка), як у Apple Music.
     *
     * @return Collection<int, Track>
     */
    private function mixTracks(User $user, string $key, int $limit): Collection
    {
        $week = CarbonImmutable::now()->startOfWeek()->format('oW');
        $ids = Cache::remember("music:mix:{$key}:{$user->id}:{$week}", now()->addHours(12), function () use ($user, $key) {
            $since = CarbonImmutable::now()->subDays(90);
            $genres = $this->topGenres($user, 5);

            $query = match ($key) {
                'favorites' => $this->topPlayed($user, $since, self::MIX_SIZE)->pluck('id'),
                'discovery' => $this->ready()->when($genres !== [], fn (Builder $q) => $q->whereIn('genre', $genres))
                    ->whereNotIn('id', $this->playedIds($user))->orderByDesc('plays_count')->limit(self::MIX_SIZE)->pluck('id'),
                'new' => $this->ready()->when($genres !== [], fn (Builder $q) => $q->whereIn('genre', $genres))
                    ->where('created_at', '>=', now()->subDays(60))->latest()->limit(self::MIX_SIZE)->pluck('id'),
                'friends' => $this->friendsTop($user, self::MIX_SIZE),
                'chill' => $this->ready()->where(fn (Builder $q) => $q->whereIn(DB::raw('LOWER(genre)'), self::CHILL_GENRES))
                    ->inRandomOrder(crc32($user->id.date('oW')))->limit(self::MIX_SIZE)->pluck('id'),
                default => collect(),
            };

            return array_values(collect($query)->map(fn ($id) => (int) $id)->all());
        });

        return $this->ordered(array_slice($ids, 0, $limit));
    }

    /**
     * Найбільше прослухані треки за період.
     *
     * @return Collection<int, Track>
     */
    private function topPlayed(User $user, CarbonImmutable $since, int $limit, ?CarbonImmutable $until = null): Collection
    {
        $ids = DB::table('music_plays')->where('user_id', $user->id)->whereNotNull('track_id')
            ->where('played_at', '>=', $since)->when($until, fn ($q) => $q->where('played_at', '<', $until))
            ->groupBy('track_id')->selectRaw('track_id, COUNT(*) as total')
            ->orderByDesc('total')->limit($limit)->pluck('track_id')->map(fn ($id) => (int) $id)->all();

        return $this->ordered(array_values($ids));
    }

    /**
     * @return list<int>
     */
    private function friendsTop(User $user, int $limit): array
    {
        $ids = $this->listeningFriendIds($user);
        if ($ids === []) {
            return [];
        }

        return array_values(DB::table('music_plays')->whereIn('user_id', $ids)->whereNotNull('track_id')
            ->where('played_at', '>=', now()->subDays(30))
            ->groupBy('track_id')->selectRaw('track_id, COUNT(DISTINCT user_id) as people, COUNT(*) as total')
            ->orderByDesc('people')->orderByDesc('total')->limit($limit)
            ->pluck('track_id')->map(fn ($id) => (int) $id)->all());
    }

    /**
     * @return list<string>
     */
    private function topGenres(User $user, int $limit): array
    {
        $fromPlays = DB::table('music_plays as p')->join('tracks as t', 't.id', '=', 'p.track_id')
            ->where('p.user_id', $user->id)->whereNotNull('t.genre')->where('t.genre', '!=', '')
            ->groupBy('t.genre')->selectRaw('t.genre, COUNT(*) as total')->orderByDesc('total')
            ->limit($limit)->pluck('t.genre');
        if ($fromPlays->isNotEmpty()) {
            return array_values(array_map('strval', $fromPlays->all()));
        }

        return array_values(array_map('strval', $user->library()->whereNotNull('genre')->groupBy('genre')
            ->selectRaw('genre, COUNT(*) as total')->orderByDesc('total')->limit($limit)->pluck('genre')->all()));
    }

    /**
     * @return list<int>
     */
    private function playedIds(User $user): array
    {
        return array_values(DB::table('music_plays')->where('user_id', $user->id)->whereNotNull('track_id')
            ->distinct()->limit(2000)->pluck('track_id')->map(fn ($id) => (int) $id)->all());
    }

    // ───────────────────────── Нове ─────────────────────────

    /**
     * @return array<string, mixed>
     */
    public function newest(User $user): array
    {
        $featured = Playlist::query()->where('is_featured', true)->where('is_public', true)
            ->with(['tracks' => fn ($q) => $q->limit(4)])->latest('updated_at')->limit(30)->get();

        $moods = $featured->whereNotNull('category')->groupBy('category')
            ->map(fn (Collection $items, string $category) => [
                'category' => $category,
                'playlists' => $items->map(fn (Playlist $p) => $this->playlistCard($p))->values()->all(),
            ])->values()->all();

        return [
            'featured' => $featured->whereNull('category')->take(8)->map(fn (Playlist $p) => $this->playlistCard($p))->values()->all(),
            'latest_songs' => $this->cards($this->ready()->latest()->limit(20)->get(), $user),
            'new_albums' => $this->albums($this->ready()->whereNotNull('album')->where('created_at', '>=', now()->subDays(120)), 12),
            'charts' => array_slice($this->chart(null, 20), 0, 20),
            'chart_cards' => $this->cards($this->ordered(array_slice($this->chartIds(null, 20), 0, 20)), $user),
            'moods' => $moods,
            'genres' => $this->genres(16),
        ];
    }

    /**
     * Чарт: найбільше слухачів за 7 днів (по всьому сайту чи в країні глядача).
     *
     * @return list<int>
     */
    public function chartIds(?string $country, int $limit): array
    {
        return Cache::remember('music:chart:'.($country ?? 'all').":{$limit}", now()->addMinutes(30), function () use ($country, $limit) {
            return array_values(DB::table('music_plays as p')
                ->join('tracks as t', 't.id', '=', 'p.track_id')->whereNull('t.deleted_at')->where('t.processing', false)
                ->when($country, fn ($q) => $q->join('users as u', 'u.id', '=', 'p.user_id')->where('u.country', $country))
                ->where('p.played_at', '>=', now()->subDays(7))
                ->groupBy('p.track_id')->selectRaw('p.track_id, COUNT(DISTINCT p.user_id) as people, COUNT(*) as total')
                ->orderByDesc('people')->orderByDesc('total')->limit($limit)
                ->pluck('p.track_id')->map(fn ($id) => (int) $id)->all());
        });
    }

    /**
     * Позиції чарту з запасним варіантом: доки прослуховувань мало, рахуємо за загальною популярністю.
     *
     * @return list<int>
     */
    private function chart(?string $country, int $limit): array
    {
        $ids = $this->chartIds($country, $limit);
        if (count($ids) < 5) {
            $ids = array_values(array_unique([...$ids, ...$this->ready()->orderByDesc('plays_count')->limit($limit)->pluck('id')->all()]));
        }

        return array_slice($ids, 0, $limit);
    }

    /**
     * @return array<string, mixed>
     */
    public function charts(User $user): array
    {
        $country = $user->country ?: null;

        return [
            'week' => $this->cards($this->ordered($this->chart(null, 100)), $user),
            'country' => $country ? $this->cards($this->ordered($this->chartIds($country, 50)), $user) : [],
            'country_name' => $country,
        ];
    }

    /**
     * Жанри з кількістю треків і обкладинкою найпопулярнішого.
     *
     * @return list<array<string, mixed>>
     */
    public function genres(int $limit = 40): array
    {
        return Cache::remember("music:genres:{$limit}", now()->addMinutes(30), function () use ($limit) {
            return array_values($this->ready()->whereNotNull('genre')->where('genre', '!=', '')
                ->groupBy('genre')->selectRaw('genre, COUNT(*) as total, MAX(cover_path) as cover')
                ->orderByDesc('total')->limit($limit)->get()
                ->map(fn (Track $row) => $this->genreCard($row))->all());
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function genre(User $user, string $name): array
    {
        $base = fn () => $this->ready()->where('genre', $name);

        return [
            'name' => $name,
            'popular' => $this->cards($base()->orderByDesc('plays_count')->limit(20)->get(), $user),
            'latest' => $this->cards($base()->latest()->limit(20)->get(), $user),
            'albums' => $this->albums($base()->whereNotNull('album'), 12),
            'station' => $this->genreStation($name),
        ];
    }

    // ───────────────────────── Радіо ─────────────────────────

    /**
     * @return array<string, mixed>
     */
    public function radio(User $user): array
    {
        $stations = RadioStation::query()->where('is_active', true)->orderBy('position')->orderBy('name')->get();

        return [
            'my_station' => $this->myStationCard($user),
            'live' => $stations->map(fn (RadioStation $s) => $s->toCard())->values()->all(),
            'by_genre' => $stations->whereNotNull('genre')->groupBy('genre')
                ->map(fn (Collection $items, string $genre) => ['genre' => $genre, 'stations' => $items->map(fn (RadioStation $s) => $s->toCard())->values()->all()])
                ->values()->all(),
            'genre_stations' => $this->genreStations(),
            'group_stations' => $this->groupStations($user),
        ];
    }

    /**
     * Станції груп людини: нескінченний потік із того, що слухають учасники сім’ї, клану чи спільноти.
     *
     * @return list<array<string, mixed>>
     */
    public function groupStations(User $user): array
    {
        return array_map(fn (array $group) => [
            'kind' => 'station',
            'key' => 'group:'.$group['type'].':'.$group['id'],
            'name' => $group['name'],
            'colors' => $this->colorsFor($group['name']),
            'covers' => $group['avatar_url'] ? [$group['avatar_url']] : [],
        ], array_slice(app(ListenRooms::class)->groupsOf($user), 0, 12));
    }

    /**
     * Чим живе група: найчастіші треки й виконавці учасників за 90 днів (крім тих, хто приховав «Зараз слухаю»).
     * Не учасник групи — нічого.
     *
     * @return array{tracks: list<int>, artists: list<string>}
     */
    private function groupTaste(User $user, string $type, int $id): array
    {
        $rooms = app(ListenRooms::class);
        $ids = $rooms->memberIds($type, $id);
        if (! $ids->contains($user->id)) {
            return ['tracks' => [], 'artists' => []];
        }
        $visible = User::query()->whereIn('id', $ids->all())->get(['id', 'preferences'])->filter(fn (User $u) => $u->showsListening())->pluck('id')->all();
        $plays = DB::table('music_plays')->whereIn('user_id', $visible)->where('played_at', '>=', now()->subDays(90));

        return [
            'tracks' => array_values(array_map('intval', (clone $plays)->whereNotNull('track_id')->groupBy('track_id')->selectRaw('track_id, COUNT(*) as total')
                ->orderByDesc('total')->limit(300)->pluck('track_id')->all())),
            'artists' => array_values(array_map('strval', (clone $plays)->where('artist', '!=', '')->groupBy('artist')->selectRaw('artist, COUNT(*) as total')
                ->orderByDesc('total')->limit(20)->pluck('artist')->all())),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function myStationCard(User $user): array
    {
        return [
            'kind' => 'station',
            'key' => 'me',
            // Підписи («Станція {name}» тощо) — на клієнті через tr(): тут лише ключ і дані.
            'name' => $user->first_name ?: $user->name,
            'colors' => ['#2f7bff', '#22d3ee'],
            // Обкладинка станції — аватар людини на всю картку; без аватара — мозаїка з того, що вона слухає найчастіше.
            'covers' => $user->avatar_url ? [$user->avatar_url] : DB::table('music_plays')->where('user_id', $user->id)->whereNotNull('cover_url')
                ->groupBy('cover_url')->selectRaw('cover_url, COUNT(*) as total')
                ->orderByDesc('total')->limit(4)->pluck('cover_url')->all(),
        ];
    }

    /**
     * Нескінченні станції за жанрами нашого каталогу.
     *
     * @return list<array<string, mixed>>
     */
    public function genreStations(): array
    {
        return array_map(fn (array $genre) => $this->genreStation($genre['name'], $genre['cover_url']), $this->genres(12));
    }

    /**
     * @return array<string, mixed>
     */
    private function genreStation(string $name, ?string $cover = null): array
    {
        return [
            'kind' => 'station',
            'key' => 'genre:'.$name,
            'name' => $name,
            'colors' => $this->colorsFor($name),
            'covers' => $cover ? [$cover] : [],
        ];
    }

    /**
     * Наступна порція нескінченної станції: me (за історією), genre:…, artist:…, track:… (схожі).
     *
     * @param  list<int>  $exclude
     * @return list<array<string, mixed>>
     */
    public function station(User $user, string $key, array $exclude = []): array
    {
        [$kind, $value] = array_pad(explode(':', $key, 2), 2, '');
        $query = $this->ready()->whereNotIn('id', array_slice($exclude, -500));

        match ($kind) {
            'me' => ($genres = $this->topGenres($user, 6)) !== []
                ? $query->where(fn (Builder $q) => $q->whereIn('genre', $genres)->orWhereIn('artist', $this->topArtists($user, 8)))
                : null,
            'genre' => $query->where('genre', $value),
            'group' => ($taste = $this->groupTaste($user, ...$this->groupKey($value)))['tracks'] !== [] || $taste['artists'] !== []
                ? $query->where(fn (Builder $q) => $q->whereIn('id', $taste['tracks'])->orWhereIn('artist', $taste['artists']))
                : $query->whereRaw('1 = 0'),
            'artist' => $query->where(fn (Builder $q) => $q->where('artist', $value)->orWhereIn('genre', $this->artistGenres($value))),
            'track' => ($seed = Track::query()->find((int) $value)) !== null
                ? $query->where(fn (Builder $q) => $q->where('artist', $seed->artist)->when($seed->genre, fn (Builder $q) => $q->orWhere('genre', $seed->genre)))
                : null,
            default => $query->whereRaw('1 = 0'),
        };

        return $this->cards($query->inRandomOrder()->limit(self::STATION_BATCH)->get(), $user);
    }

    /**
     * «family:12» → ['family', 12].
     *
     * @return array{0: string, 1: int}
     */
    private function groupKey(string $value): array
    {
        [$type, $id] = array_pad(explode(':', $value, 2), 2, '0');

        return [in_array($type, ['family', 'clan', 'community'], true) ? $type : 'community', (int) $id];
    }

    /**
     * @return list<string>
     */
    private function topArtists(User $user, int $limit): array
    {
        return array_values(DB::table('music_plays')->where('user_id', $user->id)->where('artist', '!=', '')
            ->groupBy('artist')->selectRaw('artist, COUNT(*) as total')->orderByDesc('total')->limit($limit)->pluck('artist')->map(fn ($a) => (string) $a)->all());
    }

    /**
     * @return list<string>
     */
    private function artistGenres(string $artist): array
    {
        return array_values(array_map('strval', $this->ready()->where('artist', $artist)->whereNotNull('genre')->distinct()->limit(3)->pluck('genre')->all()));
    }

    // ───────────────────────── Медіатека ─────────────────────────

    /**
     * @return array<string, mixed>
     */
    public function library(User $user): array
    {
        $library = fn () => $user->library()->where('tracks.processing', false);

        return [
            'counts' => [
                'playlists' => $this->libraryPlaylistsQuery($user)->count(),
                'artists' => $library()->distinct()->count('tracks.artist'),
                'albums' => $library()->whereNotNull('tracks.album')->distinct()->count('tracks.album'),
                'songs' => $library()->count(),
                'favorites' => $library()->wherePivot('is_favorite', true)->count(),
                'genres' => $library()->whereNotNull('tracks.genre')->distinct()->count('tracks.genre'),
            ],
            'recently_added' => $this->recentlyAdded($user, 60),
        ];
    }

    /**
     * Нещодавно додане: альбоми — одна плитка на альбом, пісні без альбому — окремо, плейлисти.
     *
     * @return list<array<string, mixed>>
     */
    public function recentlyAdded(User $user, int $limit): array
    {
        $items = [];
        $seenAlbums = [];
        $tracks = $user->library()->where('tracks.processing', false)->orderByPivot('created_at', 'desc')->limit($limit * 3)->get();
        foreach ($tracks as $track) {
            /** @var Track $track */
            $added = (string) $track->getRelationValue('pivot')?->created_at;
            if ($track->album) {
                $albumKey = mb_strtolower($track->artist.'|'.$track->album);
                if (isset($seenAlbums[$albumKey])) {
                    continue;
                }
                $seenAlbums[$albumKey] = true;
                $items[] = ['kind' => 'album', 'title' => $track->album, 'subtitle' => $track->artist, 'cover_url' => $track->cover_url, 'href' => $this->albumHref($track->artist, $track->album), 'added_at' => $added];
            } else {
                $items[] = ['kind' => 'track', 'title' => $track->title, 'subtitle' => $track->artist, 'cover_url' => $track->cover_url, 'track' => $track->toCard(true), 'added_at' => $added];
            }
        }
        foreach ($this->libraryPlaylistsQuery($user)->with(['tracks' => fn ($q) => $q->limit(4)])->latest('updated_at')->limit(20)->get() as $playlist) {
            $items[] = ['kind' => 'playlist', 'title' => $playlist->title, 'subtitle' => null, 'playlist' => $this->playlistCard($playlist), 'href' => '/music/playlists/'.$playlist->id, 'added_at' => $playlist->updated_at->toDateTimeString()];
        }
        usort($items, fn ($a, $b) => strcmp((string) $b['added_at'], (string) $a['added_at']));

        return array_slice($items, 0, $limit);
    }

    /**
     * Свої плейлисти й ті, де людина співавтор.
     *
     * @return Builder<Playlist>
     */
    public function libraryPlaylistsQuery(User $user): Builder
    {
        return Playlist::query()->where(fn (Builder $q) => $q->where('user_id', $user->id)
            ->orWhereIn('id', DB::table('playlist_collaborators')->where('user_id', $user->id)->select('playlist_id')));
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function libraryPlaylists(User $user): array
    {
        return array_values($this->libraryPlaylistsQuery($user)->with(['tracks' => fn ($q) => $q->limit(4)])->latest('updated_at')->get()
            ->map(fn (Playlist $p) => $this->playlistCard($p))->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function libraryArtists(User $user): array
    {
        return array_values($user->library()->where('tracks.processing', false)->where('tracks.artist', '!=', '')
            ->groupBy('tracks.artist')->selectRaw('tracks.artist as artist, COUNT(*) as total, MAX(tracks.cover_path) as cover')
            ->orderBy('tracks.artist')->get()
            ->map(fn (Track $row) => $this->artistRowCard($row))->all());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function libraryAlbums(User $user): array
    {
        return $this->albums($user->library()->getQuery()->where('tracks.processing', false)->whereNotNull('tracks.album'), 500);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function libraryGenres(User $user): array
    {
        return array_values($user->library()->where('tracks.processing', false)->whereNotNull('tracks.genre')->where('tracks.genre', '!=', '')
            ->groupBy('tracks.genre')->selectRaw('tracks.genre as genre, COUNT(*) as total, MAX(tracks.cover_path) as cover')
            ->orderBy('tracks.genre')->get()
            ->map(fn (Track $row) => $this->genreCard($row))->all());
    }

    /**
     * Обкладинки плиток бічного меню «Музики» (ПК): перші чотири — топ GameCon за прослуховуваннями,
     * решта — з медіатеки людини. Кеш — 10 хвилин; порожні значення плитка показує як звичайну.
     *
     * @return array{top: list<array{cover_url: string|null, title: string, artist: string}>, tiles: array<string, string|null>}
     */
    public function menuCovers(User $user): array
    {
        return Cache::remember("music:menu:{$user->id}", now()->addMinutes(10), function () use ($user) {
            $chart = $this->chart(null, 20);
            $tracks = Track::query()->whereIn('id', $chart)->get()->keyBy('id');
            $top = [];
            foreach (array_slice($chart, 0, 4) as $id) {
                $track = $tracks->get($id);
                if ($track instanceof Track) {
                    $top[] = ['cover_url' => $track->cover_url, 'title' => $track->title, 'artist' => $track->artist];
                }
            }

            $library = fn () => $user->library()->where('tracks.processing', false);
            $lastPlayed = DB::table('music_plays')->where('user_id', $user->id)->whereNotNull('cover_url')->latest('played_at')->value('cover_url');
            $topArtist = $library()->where('tracks.artist', '!=', '')->groupBy('tracks.artist')
                ->selectRaw('tracks.artist as artist, COUNT(*) as total')->orderByDesc('total')->value('artist');
            $topGenre = $library()->whereNotNull('tracks.genre')->where('tracks.genre', '!=', '')->groupBy('tracks.genre')
                ->selectRaw('tracks.genre as genre, COUNT(*) as total')->orderByDesc('total')->value('genre');
            $cover = fn (?Track $track) => $track?->cover_url;
            $rooms = $tracks->filter(fn (Track $t) => $t->cover_url !== null)->shuffle()->first();

            return [
                'top' => $top,
                'tiles' => [
                    // «Нещодавно додане» — обкладинка останнього прослуханого, інакше останнього доданого.
                    'recent' => is_string($lastPlayed) ? $lastPlayed : $cover($library()->whereNotNull('tracks.cover_path')->orderByPivot('created_at', 'desc')->first()),
                    'artists' => is_string($topArtist) ? ($this->artistInfo->cachedImage($topArtist)
                        ?? $cover($library()->where('tracks.artist', $topArtist)->whereNotNull('tracks.cover_path')->first())) : null,
                    'albums' => $cover($library()->whereNotNull('tracks.album')->whereNotNull('tracks.cover_path')->orderByPivot('created_at', 'desc')->first()),
                    'songs' => $cover($library()->whereNotNull('tracks.cover_path')->inRandomOrder()->first()),
                    'favorites' => $cover($library()->wherePivot('is_favorite', true)->whereNotNull('tracks.cover_path')->orderByPivot('created_at', 'desc')->first()),
                    'genres' => is_string($topGenre) ? $cover($library()->where('tracks.genre', $topGenre)->whereNotNull('tracks.cover_path')->first()) : null,
                    // Spotify — обкладинка останнього прослуханого поза каталогом (Spotify), інакше аватар акаунта.
                    'spotify' => DB::table('music_plays')->where('user_id', $user->id)->whereNull('track_id')->whereNotNull('cover_url')
                        ->latest('played_at')->value('cover_url') ?? $user->spotifyAccount?->avatar_url,
                    // «Кімнати» — випадкова обкладинка з топу сайту.
                    'rooms' => $cover($rooms instanceof Track ? $rooms : null),
                ],
            ];
        });
    }

    // ───────────────────────── Пошук ─────────────────────────

    /**
     * Пошук у всьому каталозі або лише в медіатеці; знаходить і за рядком із тексту пісні.
     *
     * @return array<string, mixed>
     */
    public function search(User $user, string $q, string $scope): array
    {
        $q = trim($q);
        if ($q === '') {
            return ['tracks' => [], 'lyrics' => [], 'artists' => [], 'albums' => [], 'playlists' => [], 'stations' => []];
        }
        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
        $base = fn () => $scope === 'library'
            ? $user->library()->getQuery()->where('tracks.processing', false)
            : $this->ready();

        $tracks = $base()->where(fn ($w) => $w->where('tracks.title', 'like', $like)->orWhere('tracks.artist', 'like', $like)->orWhere('tracks.album', 'like', $like))
            ->orderByDesc('tracks.plays_count')->limit(25)->get(['tracks.*']);
        $lyrics = $base()->where('tracks.lyrics', 'like', $like)->whereNotIn('tracks.id', $tracks->pluck('id'))
            ->orderByDesc('tracks.plays_count')->limit(10)->get(['tracks.*']);

        $artists = $base()->where('tracks.artist', 'like', $like)->groupBy('tracks.artist')
            ->selectRaw('tracks.artist as artist, COUNT(*) as total, MAX(tracks.cover_path) as cover')
            ->orderByDesc('total')->limit(8)->get()
            ->map(fn (Track $row) => $this->artistRowCard($row))->values()->all();

        $playlists = $scope === 'library'
            ? $this->libraryPlaylistsQuery($user)
            : Playlist::query()->where(fn (Builder $w) => $w->where('is_public', true)->orWhere('user_id', $user->id));
        $playlists = $playlists->where('title', 'like', $like)->with(['tracks' => fn ($w) => $w->limit(4)])->limit(10)->get();

        return [
            'tracks' => $this->cards($tracks, $user),
            'lyrics' => collect($this->cards($lyrics, $user))
                ->map(fn (array $card, int $i) => [...$card, 'lyric' => $this->lyricLine((string) $lyrics[$i]->lyrics, $q)])->values()->all(),
            'artists' => $artists,
            'albums' => $this->albums($base()->whereNotNull('tracks.album')->where(fn ($w) => $w->where('tracks.album', 'like', $like)->orWhere('tracks.artist', 'like', $like)), 10),
            'playlists' => $playlists->map(fn (Playlist $p) => $this->playlistCard($p))->values()->all(),
            'stations' => $scope === 'library' ? [] : RadioStation::query()->where('is_active', true)
                ->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('genre', 'like', $like))->limit(6)->get()
                ->map(fn (RadioStation $s) => $s->toCard())->values()->all(),
        ];
    }

    /** Рядок тексту пісні, у якому знайшлося слово (без міток часу LRC). */
    private function lyricLine(string $lyrics, string $q): string
    {
        foreach (preg_split('/\R/u', $lyrics) ?: [] as $line) {
            $clean = trim((string) preg_replace('/\[[^\]]*\]/u', '', $line));
            if ($clean !== '' && mb_stripos($clean, $q) !== false) {
                return mb_substr($clean, 0, 120);
            }
        }

        return '';
    }

    // ───────────────────────── Виконавець і альбом ─────────────────────────

    /**
     * @return array<string, mixed>|null
     */
    public function artist(User $user, string $name): ?array
    {
        $base = fn () => $this->ready()->where('artist', $name);
        $top = $base()->orderByDesc('plays_count')->limit(10)->get();
        if ($top->isEmpty()) {
            return null;
        }
        $genres = $this->artistGenres($name);
        $similar = $genres === [] ? collect() : $this->ready()->whereIn('genre', $genres)->where('artist', '!=', $name)
            ->groupBy('artist')->selectRaw('artist, COUNT(*) as total, MAX(cover_path) as cover')
            ->orderByDesc('total')->limit(10)->get();
        // Мало схожих за жанром — доповнюємо схожими з Last.fm (з кешу «Про виконавця»), якщо вони є в каталозі.
        $fromInfo = array_values(array_diff((array) ($this->artistInfo->cached($name)['similar'] ?? []), $similar->pluck('artist')->all(), [$name]));
        if ($similar->count() < 4 && $fromInfo !== []) {
            $similar = $similar->concat($this->ready()->whereIn('artist', array_slice($fromInfo, 0, 20))
                ->groupBy('artist')->selectRaw('artist, COUNT(*) as total, MAX(cover_path) as cover')
                ->orderByDesc('total')->limit(10 - $similar->count())->get());
        }

        return [
            'name' => $name,
            // Фото виконавця (MusicBrainz/Wikidata/Spotify — лише з кешу, без мережі), інакше обкладинка популярного треку.
            'cover_url' => $this->artistInfo->cachedImage($name) ?? $top->first()->cover_url,
            'genre' => $genres[0] ?? null,
            'tracks_count' => $base()->count(),
            'listeners' => DB::table('music_plays')->where('artist', $name)->where('played_at', '>=', now()->subDays(30))->distinct()->count('user_id'),
            'top_songs' => $this->cards($top, $user),
            'albums' => $this->albums($base()->whereNotNull('album'), 30),
            'singles' => $this->cards($base()->whereNull('album')->latest()->limit(20)->get(), $user),
            'latest' => ($latest = $base()->latest()->first()) ? $latest->toCard() : null,
            'similar' => $similar->map(fn (Track $row) => $this->artistRowCard($row))->values()->all(),
            'station' => ['kind' => 'station', 'key' => 'artist:'.$name, 'name' => $name, 'colors' => $this->colorsFor($name), 'covers' => []],
        ];
    }

    /**
     * Виконавець без треків у нашому каталозі: порожні розділи, але станція й «Про виконавця» працюють.
     *
     * @return array<string, mixed>
     */
    public function emptyArtist(string $name): array
    {
        return [
            'name' => $name, 'cover_url' => null, 'genre' => null, 'tracks_count' => 0, 'listeners' => 0,
            'top_songs' => [], 'albums' => [], 'singles' => [], 'latest' => null, 'similar' => [],
            'station' => ['kind' => 'station', 'key' => 'artist:'.$name, 'name' => $name, 'colors' => $this->colorsFor($name), 'covers' => []],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function album(User $user, string $artist, string $title): ?array
    {
        $tracks = $this->ready()->where('artist', $artist)->where('album', $title)
            ->orderByRaw('track_no IS NULL')->orderBy('track_no')->orderBy('id')->get();
        if ($tracks->isEmpty()) {
            return null;
        }
        $known = $tracks->pluck('quality')->filter();
        $qualities = $known->unique();

        return [
            'title' => $title,
            'artist' => $artist,
            'artist_href' => $this->artistHref($artist),
            // Найнадійніша обкладинка серед треків альбому (власна, Cover Art Archive, Discogs…).
            'cover_url' => $tracks->sortByDesc(fn (Track $t) => $t->coverScore())->first()?->cover_url,
            'year' => $tracks->pluck('year')->filter()->max(),
            'genre' => $tracks->pluck('genre')->filter()->first(),
            'duration' => (int) $tracks->sum('duration'),
            // Значок альбому — за найгіршою якістю серед треків (як в Apple Music).
            'quality' => $qualities->contains(Track::QUALITY_LOSSY) || $known->count() < $tracks->count() ? null
                : ($qualities->contains(Track::QUALITY_LOSSLESS) ? Track::QUALITY_LOSSLESS : Track::QUALITY_HIRES),
            'tracks' => $this->cards($tracks, $user),
            'more_by' => array_values(array_filter(
                $this->albums($this->ready()->where('artist', $artist)->whereNotNull('album'), 12),
                fn (array $album) => $album['title'] !== $title,
            )),
        ];
    }

    /**
     * Альбоми з запиту треків: одна плитка на пару «виконавець + альбом».
     *
     * @param  Builder<Track>  $query
     * @return list<array<string, mixed>>
     */
    private function albums($query, int $limit): array
    {
        $prefix = 'tracks.';

        $rows = (clone $query)->groupBy("{$prefix}album", "{$prefix}artist")
            ->selectRaw("{$prefix}album as album, {$prefix}artist as artist, COUNT(*) as total, MAX({$prefix}cover_path) as cover, MAX({$prefix}year) as year, MAX({$prefix}created_at) as added")
            ->reorder()->orderByDesc('added')->limit($limit)->get();
        $covers = $this->bestAlbumCovers(array_values(array_map('strval', $rows->pluck('album')->filter()->unique()->all())));

        return array_values($rows
            ->map(fn (Track $row) => [
                'kind' => 'album',
                'title' => $row->album,
                'artist' => $row->artist,
                'year' => $row->year ? (int) $row->year : null,
                'tracks_count' => (int) $row->getAttribute('total'),
                'cover_url' => ($cover = $covers[$row->artist."\0".$row->album] ?? $row->getAttribute('cover')) ? Storage::disk('public')->url($cover) : null,
                'href' => $this->albumHref((string) $row->artist, (string) $row->album),
            ])->all());
    }

    /**
     * Найнадійніша обкладинка кожного альбому (за походженням у metadata_meta) — один запит на всі плитки.
     *
     * @param  list<string>  $albums
     * @return array<string, string> «виконавець\0альбом» → cover_path
     */
    private function bestAlbumCovers(array $albums): array
    {
        if ($albums === []) {
            return [];
        }
        $best = [];
        $this->ready()->whereIn('album', $albums)->whereNotNull('cover_path')
            ->get(['id', 'artist', 'album', 'cover_path', 'metadata_meta'])
            ->each(function (Track $track) use (&$best) {
                $key = $track->artist."\0".$track->album;
                if (! isset($best[$key]) || $track->coverScore() > $best[$key][0]) {
                    $best[$key] = [$track->coverScore(), (string) $track->cover_path];
                }
            });

        return array_map(fn (array $b) => $b[1], $best);
    }

    /**
     * @return array<string, mixed>
     */
    private function artistCard(string $name, ?string $cover, int $total): array
    {
        return [
            'kind' => 'artist',
            'name' => $name,
            'tracks_count' => $total,
            'cover_url' => $this->artistInfo->cachedImage($name) ?? ($cover ? Storage::disk('public')->url($cover) : null),
            'href' => $this->artistHref($name),
        ];
    }

    /**
     * Картка виконавця з агрегованого рядка (artist, total, cover) — це не справжній трек, а підсумок групи.
     *
     * @return array<string, mixed>
     */
    private function artistRowCard(Track $row): array
    {
        $cover = $row->getAttribute('cover');

        return $this->artistCard((string) $row->artist, $cover !== null ? (string) $cover : null, (int) $row->getAttribute('total'));
    }

    /**
     * Плитка жанру з агрегованого рядка (genre, total, cover).
     *
     * @return array<string, mixed>
     */
    private function genreCard(Track $row): array
    {
        $cover = $row->getAttribute('cover');

        return [
            'name' => $row->genre,
            'tracks_count' => (int) $row->getAttribute('total'),
            'cover_url' => $cover ? Storage::disk('public')->url($cover) : null,
            'href' => '/music/genre?name='.rawurlencode((string) $row->genre),
        ];
    }

    public function artistHref(string $name): string
    {
        return '/music/artist?name='.rawurlencode($name);
    }

    public function albumHref(string $artist, string $album): string
    {
        return '/music/album?artist='.rawurlencode($artist).'&title='.rawurlencode($album);
    }

    // ───────────────────────── Replay ─────────────────────────

    /**
     * Replay: найчастіше слухане за рік і за кожен місяць, хвилини прослуховування.
     *
     * @return array<string, mixed>
     */
    public function replay(User $user, int $year): array
    {
        $from = CarbonImmutable::create($year, 1, 1)->startOfDay();
        $to = $from->addYear();
        $months = [];
        for ($m = 1; $m <= 12; $m++) {
            $start = CarbonImmutable::create($year, $m, 1)->startOfDay();
            if ($start->isFuture()) {
                break;
            }
            $tracks = $this->topPlayed($user, $start, 5, $start->addMonth());
            if ($tracks->isNotEmpty()) {
                $months[] = ['month' => $m, 'tracks' => $this->cards($tracks, $user)];
            }
        }
        $seconds = (int) DB::table('music_plays as p')->join('tracks as t', 't.id', '=', 'p.track_id')
            ->where('p.user_id', $user->id)->where('p.played_at', '>=', $from)->where('p.played_at', '<', $to)->sum('t.duration');
        $years = DB::table('music_plays')->where('user_id', $user->id)->selectRaw('MIN(played_at) as first')->value('first');

        return [
            'year' => $year,
            'years' => range((int) ($years ? substr((string) $years, 0, 4) : $year), (int) CarbonImmutable::now()->year),
            'minutes' => intdiv($seconds, 60),
            'plays' => DB::table('music_plays')->where('user_id', $user->id)->where('played_at', '>=', $from)->where('played_at', '<', $to)->count(),
            'tracks' => $this->cards($this->topPlayed($user, $from, 25, $to), $user),
            'artists' => collect(DB::table('music_plays')->where('user_id', $user->id)->where('artist', '!=', '')
                ->where('played_at', '>=', $from)->where('played_at', '<', $to)
                ->groupBy('artist')->selectRaw('artist, COUNT(*) as total')->orderByDesc('total')->limit(10)->get())
                ->map(fn ($row) => [...$this->artistCard((string) $row->artist, $this->ready()->where('artist', $row->artist)->orderByDesc('plays_count')->value('cover_path'), 0), 'plays' => (int) $row->total])
                ->values()->all(),
            'months' => $months,
        ];
    }

    // ───────────────────────── Допоміжне ─────────────────────────

    /**
     * @return Builder<Track>
     */
    private function ready(): Builder
    {
        return Track::query()->ready();
    }

    /**
     * Треки в заданому порядку ідентифікаторів.
     *
     * @param  list<int|string>  $ids
     * @return Collection<int, Track>
     */
    private function ordered(array $ids): Collection
    {
        if ($ids === []) {
            return collect();
        }
        $found = Track::query()->ready()->whereIn('id', $ids)->get()->keyBy('id');

        return collect($ids)->map(fn ($id) => $found->get((int) $id))->filter()->values();
    }

    /**
     * @param  iterable<int, Track>  $tracks
     * @return list<array<string, mixed>>
     */
    private function cards(iterable $tracks, User $user): array
    {
        return $this->music->cards($tracks, $user);
    }

    /**
     * @return array<string, mixed>
     */
    public function playlistCard(Playlist $playlist): array
    {
        return [...$playlist->toCard(), 'kind' => 'playlist', 'href' => '/music/playlists/'.$playlist->id];
    }

    /**
     * Стабільна пара кольорів для обкладинки станції за назвою.
     *
     * @return array{0: string, 1: string}
     */
    private function colorsFor(string $seed): array
    {
        $palette = [['#2f7bff', '#1a2f7a'], ['#3d63ff', '#0b1638'], ['#22c4f0', '#2a6cff'], ['#4d9bff', '#123a8c'], ['#38e1ff', '#3d63ff'], ['#1d6fe0', '#22d3ee'], ['#7aa8ff', '#0d1b4a']];

        return $palette[crc32($seed) % count($palette)];
    }
}
