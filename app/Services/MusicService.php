<?php

namespace App\Services;

use App\Models\MusicStatus;
use App\Models\Playlist;
use App\Models\Track;
use App\Models\User;
use App\Services\Spotify\SpotifyClient;
use App\Services\Spotify\SpotifyException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class MusicService
{
    public function __construct(
        private readonly ImageStorage $images,
        private readonly SpotifyClient $spotify,
    ) {}

    /**
     * @param  array{title: string, artist: string, album?: string|null, genre?: string|null, duration?: int|null, cover_url?: string|null}  $meta
     */
    public function upload(User $user, UploadedFile $audio, array $meta, ?UploadedFile $cover = null): Track
    {
        $extension = strtolower($audio->getClientOriginalExtension() ?: $audio->extension() ?: 'mp3');
        $path = $audio->storeAs('music/'.now()->format('Y/m'), Str::random(32).'.'.$extension, 'public');
        $coverPath = $cover ? $this->images->store($cover, 'music/covers', cover: [600, 600])['path']
            : (filled($meta['cover_url'] ?? null) ? $this->coverFromUrl((string) $meta['cover_url']) : null);

        $track = Track::query()->create([
            'user_id' => $user->id,
            'title' => Str::limit(trim($meta['title']), 150, ''),
            'artist' => Str::limit(trim($meta['artist']), 150, ''),
            'album' => isset($meta['album']) ? Str::limit(trim($meta['album']), 150, '') ?: null : null,
            'genre' => isset($meta['genre']) ? Str::limit(trim($meta['genre']), 40, '') ?: null : null,
            'duration' => (int) ($meta['duration'] ?? 0),
            'path' => $path,
            'cover_path' => $coverPath,
            'mime' => $audio->getMimeType(),
            'size' => (int) $audio->getSize(),
        ]);

        $this->add($user, $track);

        return $track;
    }

    /** Хости, звідки сервер сам завантажує обкладинки за посиланням (каталог iTunes). */
    public const COVER_HOSTS = ['mzstatic.com'];

    /**
     * Обкладинка за посиланням із каталогу (автозаповнення в застосунку): лише https і лише з COVER_HOSTS,
     * щоб сервер не ходив куди завгодно. Повертає шлях збереженої обкладинки або null.
     */
    public function coverFromUrl(string $url): ?string
    {
        $parts = parse_url($url);
        $host = strtolower((string) ($parts['host'] ?? ''));
        $allowed = collect(self::COVER_HOSTS)->contains(fn (string $h) => $host === $h || str_ends_with($host, '.'.$h));
        if (($parts['scheme'] ?? '') !== 'https' || ! $allowed) {
            return null;
        }

        try {
            $response = Http::timeout(10)->withOptions(['allow_redirects' => false])->get($url);
        } catch (ConnectionException) {
            return null;
        }

        $body = $response->body();
        if (! $response->successful() || ! str_starts_with((string) $response->header('Content-Type'), 'image/') || $body === '' || strlen($body) > 5 * 1024 * 1024) {
            return null;
        }

        $temp = tempnam(sys_get_temp_dir(), 'cover');
        if ($temp === false) {
            return null;
        }

        try {
            file_put_contents($temp, $body);
            $file = new UploadedFile($temp, 'cover', null, null, true);
            if (! str_starts_with((string) $file->getMimeType(), 'image/')) {
                return null;
            }

            return $this->images->store($file, 'music/covers', cover: [600, 600])['path'];
        } catch (Throwable) {
            return null;
        } finally {
            @unlink($temp);
        }
    }

    public function add(User $user, Track $track): bool
    {
        $inserted = DB::table('music_library')->insertOrIgnore([
            'user_id' => $user->id,
            'track_id' => $track->id,
            'created_at' => now(),
        ]);

        if ($inserted) {
            $track->increment('adds_count');
        }

        return $inserted > 0;
    }

    public function remove(User $user, Track $track): void
    {
        $deleted = DB::table('music_library')->where('user_id', $user->id)->where('track_id', $track->id)->delete();
        if ($deleted && $track->adds_count > 0) {
            $track->decrement('adds_count');
        }
    }

    /**
     * @param  iterable<int>  $trackIds
     * @return array<int, true>
     */
    public function libraryIds(User $user, iterable $trackIds): array
    {
        $ids = [];
        foreach ($trackIds as $id) {
            $ids[] = $id;
        }
        $ids = array_values(array_unique($ids));
        if ($ids === []) {
            return [];
        }

        $owned = [];
        foreach (DB::table('music_library')->where('user_id', $user->id)->whereIn('track_id', $ids)->pluck('track_id') as $id) {
            if (is_numeric($id)) {
                $owned[(int) $id] = true;
            }
        }

        return $owned;
    }

    /**
     * @param  iterable<int|string, Track>  $tracks
     * @return list<array<string, mixed>>
     */
    public function cards(iterable $tracks, User $viewer): array
    {
        $tracks = collect($tracks);
        $trackIds = [];
        foreach ($tracks->pluck('id') as $id) {
            if (is_numeric($id)) {
                $trackIds[] = (int) $id;
            }
        }
        $owned = $this->libraryIds($viewer, $trackIds);

        return array_values($tracks->map(fn (Track $t) => $t->toCard(isset($owned[$t->id])))->all());
    }

    public function canManageTrack(Track $track, User $user): bool
    {
        return $track->user_id === $user->id || $user->isStaff();
    }

    /**
     * @param  array{title: string, description: string|null, is_public: bool}  $data
     */
    public function createPlaylist(User $user, array $data): Playlist
    {
        if ($user->playlists()->count() >= Playlist::MAX_PER_USER) {
            throw ValidationException::withMessages(['title' => 'Досягнуто ліміт плейлистів ('.Playlist::MAX_PER_USER.').']);
        }

        return $user->playlists()->create($data);
    }

    public function attach(Playlist $playlist, Track $track): bool
    {
        if ($playlist->tracks_count >= Playlist::MAX_TRACKS) {
            throw ValidationException::withMessages(['track' => 'У плейлисті вже максимум треків.']);
        }

        $position = (int) DB::table('playlist_track')->where('playlist_id', $playlist->id)->max('position') + 1;
        $inserted = DB::table('playlist_track')->insertOrIgnore([
            'playlist_id' => $playlist->id,
            'track_id' => $track->id,
            'position' => $position,
            'created_at' => now(),
        ]);

        $playlist->recount();
        $playlist->touch();

        return $inserted > 0;
    }

    public function detach(Playlist $playlist, Track $track): void
    {
        $playlist->tracks()->detach($track->id);
        $playlist->recount();
    }

    public function canViewPlaylist(Playlist $playlist, User $viewer): bool
    {
        return $playlist->is_public
            || $playlist->user_id === $viewer->id
            || $viewer->isStaff()
            || $this->collaborates($playlist, $viewer);
    }

    public function canManagePlaylist(Playlist $playlist, User $viewer): bool
    {
        return $playlist->user_id === $viewer->id || $viewer->isStaff() || $this->collaborates($playlist, $viewer);
    }

    public function collaborates(Playlist $playlist, User $viewer): bool
    {
        return DB::table('playlist_collaborators')->where('playlist_id', $playlist->id)->where('user_id', $viewer->id)->exists();
    }

    /**
     * Треки того самого виконавця, потім того самого жанру.
     *
     * @return list<Track>
     */
    public function similarTracks(Track $track): array
    {
        return Track::query()
            ->whereKeyNot($track->id)
            ->where(function (Builder $query) use ($track) {
                $query->where('artist', $track->artist);
                if (is_string($track->genre) && $track->genre !== '') {
                    $query->orWhere('genre', $track->genre);
                }
            })
            ->orderByRaw('case when artist = ? then 0 else 1 end', [$track->artist])
            ->orderByDesc('plays_count')
            ->limit(8)
            ->get()
            ->all();
    }

    /**
     * Фіксує, що користувач почав слухати трек.
     *
     * @param  array<string, mixed>|null  $spotifyTrack
     */
    public function nowPlaying(User $user, ?Track $track, ?array $spotifyTrack = null): void
    {
        $duration = $track !== null ? $track->duration : (int) ($spotifyTrack['duration'] ?? 0);

        MusicStatus::query()->updateOrCreate(['user_id' => $user->id], [
            'source' => $track ? 'local' : 'spotify',
            'track_id' => $track?->id,
            'payload' => $track ? null : $spotifyTrack,
            'expires_at' => now()->addSeconds(max($duration, 120) + 60),
        ]);

        if ($track) {
            $track->increment('plays_count');
        }

        Cache::forget($this->statusCacheKey($user));
    }

    public function stop(User $user): void
    {
        MusicStatus::query()->whereKey($user->id)->update(['expires_at' => now()]);
        Cache::forget($this->statusCacheKey($user));
    }

    /**
     * Що зараз слухає користувач: трек із плеєра GameCon або з Spotify.
     * Позначка «вже у моїх аудіозаписах» рахується для [$viewer] поза кешем, бо кеш спільний для всіх глядачів.
     *
     * @return array<string, mixed>|null
     */
    public function currentFor(User $user, ?User $viewer = null): ?array
    {
        $now = $this->cachedCurrent($user);
        if ($now !== null && ($now['source'] ?? null) === 'local' && isset($now['id'])) {
            $now['in_library'] = $viewer !== null && $viewer->library()->whereKey($now['id'])->exists();
        }

        return $now;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function cachedCurrent(User $user): ?array
    {
        return Cache::remember($this->statusCacheKey($user), now()->addSeconds(30), function () use ($user) {
            $status = $user->musicStatus()->with('track')->first();
            if ($status?->isActive()) {
                if ($status->source === 'local' && $status->track && ! $status->track->trashed()) {
                    return [...$status->track->toCard(), 'is_playing' => true, 'via' => 'gamecon'];
                }

                if ($status->source === 'spotify' && $status->payload) {
                    return [...$status->payload, 'is_playing' => true, 'via' => 'gamecon'];
                }
            }

            $account = $user->spotifyAccount;
            if (! $account?->show_now_playing || ! $this->spotify->configured()) {
                return null;
            }

            try {
                $current = $this->spotify->currentlyPlaying($account);
            } catch (SpotifyException|ConnectionException) {
                return null;
            }

            return $current ? [...$current, 'via' => 'spotify'] : null;
        });
    }

    private function statusCacheKey(User $user): string
    {
        return 'music.now.'.$user->id;
    }
}
