<?php

namespace App\Services\Music;

use App\Jobs\WarmArtistInfo;
use App\Models\Track;
use App\Services\MusicService;
use App\Services\Spotify\SpotifyClient;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Автоматичні метадані треку з усіх доступних джерел разом, а не «перше, що знайшлося»:
 * теги файлу, AcoustID (відбиток звуку) → MusicBrainz, пошук MusicBrainz, Discogs, Spotify, Last.fm,
 * Cover Art Archive і LRCLIB. Кожне джерело дає кандидатів із довірою (0–100), MetaMatch вибирає
 * для кожного поля найкраще значення (збіг кількох джерел — бонус), а чужий запис (інший виконавець,
 * тривалість ±5 с) відкидається ще на вході.
 *
 * Правила запису: введене користувачем (metadata_meta[поле].source = user, а також заповнене поле
 * без відомого походження) не змінюється ніколи; заповнене автоматикою замінюється лише значенням
 * з вищою довірою; нічого не видаляється. Будь-який збій джерела — лише попередження в журналі.
 */
class MetadataEnricher
{
    /** Довіра джерел: AcoustID+MusicBrainz > MusicBrainz > Discogs ≈ Spotify > Last.fm > теги файлу. */
    public const SCORE_ACOUSTID = 95;

    public const SCORE_ACOUSTID_RELEASE = 92;

    public const SCORE_MUSICBRAINZ = 80;

    public const SCORE_DISCOGS = 65;

    public const SCORE_SPOTIFY = 65;

    public const SCORE_LASTFM = 50;

    public const SCORE_LASTFM_ALBUM = 35;

    public const SCORE_TAGS = 40;

    public const SCORE_LRCLIB = 50;

    /** Обкладинки: Cover Art Archive > Discogs > Spotify > вбудована у файл. */
    public const COVER_SCORES = ['caa' => 90, 'caa_group' => 82, 'discogs' => 75, 'spotify' => 70, 'tags' => 40];

    /** Поля, які пише автоматика (крім обкладинки), з обмеженням довжини для рядків. */
    private const FIELDS = ['title' => 150, 'artist' => 150, 'album' => 150, 'genre' => 40, 'year' => null, 'track_no' => null, 'lyrics' => null,
        'mbid' => null, 'release_mbid' => null, 'release_group_mbid' => null, 'artist_mbid' => null];

    public function __construct(
        private readonly AudioProbe $probe,
        private readonly MusicBrainz $musicbrainz,
        private readonly AcoustId $acoustid,
        private readonly Discogs $discogs,
        private readonly LastFm $lastfm,
        private readonly SpotifyClient $spotify,
        private readonly LyricsFinder $lyrics,
        private readonly MusicService $music,
    ) {}

    /** Чи дозволені зовнішні запити (MUSIC_METADATA). */
    public function online(): bool
    {
        return (bool) config('services.music_metadata.enabled', true);
    }

    /**
     * Лише дані з самого файлу (без мережі) — одразу після розбору в ProcessTrackAudio.
     *
     * @param  array{tags: array<string, string|int>, has_cover: bool}  $info
     */
    public function applyFile(Track $track, array $info, string $file): void
    {
        $this->apply($track, $this->fileCandidates($info), $file);
    }

    /**
     * Повне збагачення з усіх джерел. Повертає застосовані поля {поле: джерело}.
     *
     * @return array<string, string>
     */
    public function enrich(Track $track): array
    {
        if (! $this->online()) {
            return [];
        }
        $disk = Storage::disk('public');
        $file = $track->path !== '' && $disk->exists($track->path) ? $disk->path($track->path) : null;
        $info = $file !== null ? $this->probe->probe($file) : null;
        $duration = $track->duration > 0 ? $track->duration : ($info['duration'] ?? null);

        $candidates = $info !== null ? $this->fileCandidates($info) : [];
        $identity = null;
        foreach ([
            'acoustid' => fn () => $file !== null ? $this->fromAcoustId($track, $file, $duration) : [],
            'musicbrainz' => fn () => $this->fromMusicBrainz($track, $duration),
            'discogs' => fn () => $this->fromDiscogs($track, $duration),
            'spotify' => fn () => $this->fromSpotify($track, $duration),
            'lastfm' => fn () => $this->fromLastFm($track, $duration),
        ] as $source => $gather) {
            try {
                $found = $gather();
            } catch (Throwable $e) {
                Log::warning('Метадані треку: джерело недоступне', ['source' => $source, 'track' => $track->id, 'error' => $e->getMessage()]);
                $found = [];
            }
            $identity ??= $found !== [] ? $source : null;
            $candidates = [...$candidates, ...$found];
        }

        // Обкладинка Cover Art Archive — за релізом, який переміг серед кандидатів (або вже збереженим).
        $winners = MetaMatch::pick($candidates);
        $release = $winners['release_mbid']['value'] ?? $track->release_mbid;
        $group = $winners['release_group_mbid']['value'] ?? $track->release_group_mbid;
        if (is_string($release) && $release !== '') {
            $candidates[] = $this->cover('https://coverartarchive.org/release/'.$release.'/front-500', 'caa');
        }
        if (is_string($group) && $group !== '') {
            $candidates[] = $this->cover('https://coverartarchive.org/release-group/'.$group.'/front-500', 'caa_group');
        }

        if (blank($track->lyrics)) {
            $artist = $winners['artist']['value'] ?? $track->artist;
            $title = $winners['title']['value'] ?? $track->title;
            $album = $winners['album']['value'] ?? $track->album;
            $text = $this->lyrics->find((string) $artist, (string) $title, is_string($album) ? $album : null, $duration ?: null);
            if ($text !== null) {
                $candidates[] = ['field' => 'lyrics', 'value' => $text, 'source' => 'lrclib', 'score' => self::SCORE_LRCLIB];
            }
        }

        $applied = $this->apply($track, $candidates, $file);
        $track->forceFill([
            'metadata_source' => $identity ?? $track->metadata_source,
            'enriched_at' => now(),
        ])->saveQuietly();

        if (filled($track->artist)) {
            WarmArtistInfo::dispatch($track->artist);
        }

        return $applied;
    }

    /**
     * Записує переможців у трек за правилами (користувацьке — недоторканне, автоматичне — лише кращим).
     *
     * @param  list<array{field: string, value: mixed, source: string, score: int|float}>  $candidates
     * @return array<string, string>
     */
    public function apply(Track $track, array $candidates, ?string $file = null): array
    {
        $covers = array_values(array_filter($candidates, fn ($c) => $c['field'] === 'cover'));
        $winners = MetaMatch::pick(array_values(array_filter($candidates, fn ($c) => $c['field'] !== 'cover')));
        $meta = $track->metadata_meta ?? [];
        $applied = [];

        foreach ($winners as $field => $winner) {
            if (! array_key_exists($field, self::FIELDS)) {
                continue;
            }
            $current = $track->getAttribute($field);
            $known = $track->fieldMeta($field);
            if (! $this->mayWrite($current, $known, $winner['score'])) {
                // Те саме значення від надійнішого джерела — лише оновлюємо довіру.
                if ($known !== null && $known['source'] !== Track::SOURCE_USER && filled($current)
                    && MetaMatch::valueKey($field, $current) === MetaMatch::valueKey($field, $winner['value']) && $winner['score'] > $known['score']) {
                    $meta[$field] = ['source' => $winner['source'], 'score' => round($winner['score'], 1)];
                }

                continue;
            }
            $value = $winner['value'];
            $limit = self::FIELDS[$field];
            if (is_string($value)) {
                $value = $limit !== null ? Str::limit(trim($value), $limit, '') : trim($value);
            }
            $track->setAttribute($field, in_array($field, ['year', 'track_no'], true) ? (int) $value : $value);
            $meta[$field] = ['source' => $winner['source'], 'score' => round($winner['score'], 1)];
            $applied[$field] = $winner['source'];
        }

        $track->metadata_meta = $meta;
        $track->saveQuietly();

        $cover = $this->applyCover($track, $covers, $file);
        if ($cover !== null) {
            $applied['cover'] = $cover;
        }

        return $applied;
    }

    /** Чи можна записати значення з довірою $score у поле з поточним значенням і походженням. */
    private function mayWrite(mixed $current, ?array $known, float $score): bool
    {
        if ($known !== null && $known['source'] === Track::SOURCE_USER) {
            return false;
        }
        if (blank($current)) {
            return true;
        }

        // Заповнене без відомого походження (старі треки) — вважаємо введеним користувачем.
        return $known !== null && $score > (float) $known['score'];
    }

    /**
     * Найкраща обкладинка з кандидатів: пробуємо від найнадійнішої, доки одна не збережеться.
     * Власну обкладинку користувача не замінюємо; автоматичну — лише надійнішою (стару файл-копію прибираємо).
     *
     * @param  list<array{field: string, value: mixed, source: string, score: int|float}>  $covers
     */
    private function applyCover(Track $track, array $covers, ?string $file): ?string
    {
        $known = $track->fieldMeta('cover');
        $floor = $track->cover_path === null ? -1.0 : ($known !== null && $known['source'] !== Track::SOURCE_USER ? (float) $known['score'] : null);
        if ($floor === null) {
            return null;
        }
        usort($covers, fn ($a, $b) => $b['score'] <=> $a['score']);

        foreach ($covers as $candidate) {
            if ($candidate['score'] <= $floor) {
                break;
            }
            $path = $this->storeCover($candidate['value'], $file);
            if ($path === null) {
                continue;
            }
            $old = $track->cover_path;
            $track->forceFill([
                'cover_path' => $path,
                'metadata_meta' => [...($track->metadata_meta ?? []), 'cover' => ['source' => $candidate['source'], 'score' => round((float) $candidate['score'], 1)]],
            ])->saveQuietly();
            if ($old !== null && $old !== $path) {
                Storage::disk('public')->delete($old);
            }

            return $candidate['source'];
        }

        return null;
    }

    private function storeCover(mixed $value, ?string $file): ?string
    {
        try {
            if ($value === 'embedded') {
                $temp = $file !== null ? $this->probe->extractCover($file) : null;
                if ($temp === null) {
                    return null;
                }
                try {
                    return $this->music->storeCover(new UploadedFile($temp, basename($temp), null, null, true));
                } finally {
                    @unlink($temp);
                }
            }
            if (is_string($value)) {
                $headers = str_contains($value, 'discogs.com') ? ['User-Agent' => Discogs::USER_AGENT] : ['User-Agent' => MusicBrainz::USER_AGENT];

                return $this->music->coverFromUrl($value, MusicService::METADATA_COVER_HOSTS, $headers);
            }
        } catch (Throwable $e) {
            Log::info('Обкладинку треку не збережено', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * @param  array{tags?: array<string, string|int>, has_cover?: bool}  $info
     * @return list<array{field: string, value: mixed, source: string, score: int|float}>
     */
    private function fileCandidates(array $info): array
    {
        $candidates = [];
        foreach ((array) ($info['tags'] ?? []) as $field => $value) {
            $candidates[] = ['field' => (string) $field, 'value' => $value, 'source' => 'tags', 'score' => self::SCORE_TAGS];
        }
        if ($info['has_cover'] ?? false) {
            $candidates[] = ['field' => 'cover', 'value' => 'embedded', 'source' => 'tags', 'score' => self::COVER_SCORES['tags']];
        }

        return $candidates;
    }

    /**
     * @return list<array{field: string, value: mixed, source: string, score: int|float}>
     */
    private function fromAcoustId(Track $track, string $file, ?int $duration): array
    {
        if (! $this->acoustid->available()) {
            return [];
        }
        $print = $this->acoustid->fingerprint($file);
        if ($print === null) {
            return [];
        }
        // Відбиток збігся, але виконавець інший або тривалість відрізняється — це не наш запис.
        $match = collect($this->acoustid->lookup($print['fingerprint'], $print['duration']))->first(fn (array $r) => $r['score'] >= 0.5
            && MetaMatch::sameArtist($r['artist'], $track->artist) && MetaMatch::durationOk($r['duration'], $duration ?? $print['duration']));
        if ($match === null) {
            return [];
        }
        $score = self::SCORE_ACOUSTID * $match['score'];
        $out = $this->set('acoustid', $score, ['title' => $match['title'], 'artist' => $match['artist'], 'mbid' => $match['mbid'], 'artist_mbid' => $match['artist_mbid']]);

        $recording = $this->musicbrainz->recording($match['mbid']);
        if ($recording !== null) {
            $out = [...$out, ...$this->releaseCandidates($recording, 'acoustid', self::SCORE_ACOUSTID_RELEASE * $match['score'])];
        }

        return $out;
    }

    /**
     * @return list<array{field: string, value: mixed, source: string, score: int|float}>
     */
    private function fromMusicBrainz(Track $track, ?int $duration): array
    {
        $recording = $this->musicbrainz->searchRecordings($track->artist, $track->title, $duration)[0] ?? null;
        if ($recording === null) {
            return [];
        }
        $score = self::SCORE_MUSICBRAINZ * min(100, (int) ($recording['score'] ?? 0)) / 100;

        return [
            ...$this->set('musicbrainz', $score, [
                'title' => $recording['title'] ?? null,
                'artist' => MusicBrainz::credit($recording),
                'mbid' => $recording['id'] ?? null,
                'artist_mbid' => MusicBrainz::artistId($recording),
            ]),
            ...$this->releaseCandidates($recording, 'musicbrainz', $score),
        ];
    }

    /**
     * @param  array<string, mixed>  $recording
     * @return list<array{field: string, value: mixed, source: string, score: int|float}>
     */
    private function releaseCandidates(array $recording, string $source, float $score): array
    {
        $release = MusicBrainz::bestRelease($recording);

        return $this->set($source, $score, [
            'album' => $release['album'] ?? null,
            'year' => $release['year'] ?? null,
            'track_no' => $release['track_no'] ?? null,
            'release_mbid' => $release['release_mbid'] ?? null,
            'release_group_mbid' => $release['release_group_mbid'] ?? null,
            'genre' => MusicBrainz::topGenre($recording),
        ]);
    }

    /**
     * @return list<array{field: string, value: mixed, source: string, score: int|float}>
     */
    private function fromDiscogs(Track $track, ?int $duration): array
    {
        if (! $this->discogs->configured()) {
            return [];
        }
        $release = $this->discogs->findRelease($track->artist, $track->title, null, $duration);
        if ($release === null) {
            return [];
        }
        $out = $this->set('discogs', self::SCORE_DISCOGS, ['album' => $release['album'], 'year' => $release['year'], 'track_no' => $release['track_no']]);
        // Стилі Discogs точніші за загальні жанри: перший — повна довіра, решта — менша.
        foreach (array_slice($release['genres'], 0, 3) as $i => $genre) {
            $out[] = ['field' => 'genre', 'value' => $genre, 'source' => 'discogs', 'score' => self::SCORE_DISCOGS - 10 * $i];
        }
        if ($release['cover'] !== null) {
            $out[] = $this->cover($release['cover'], 'discogs', $release['cover_width']);
        }

        return $out;
    }

    /**
     * @return list<array{field: string, value: mixed, source: string, score: int|float}>
     */
    private function fromSpotify(Track $track, ?int $duration): array
    {
        if (! $this->spotify->configured()) {
            return [];
        }
        $found = $this->spotify->findTrack($track->artist, $track->title);
        if ($found === null || ! MetaMatch::durationOk($found['duration'] ?: null, $duration)) {
            return [];
        }
        // Сингл у Spotify — окремий «альбом» із назвою пісні; для поля «Альбом» це слабка підказка.
        $isAlbum = in_array($found['album_type'], ['album', 'compilation'], true);
        $out = [
            ...$this->set('spotify', self::SCORE_SPOTIFY, ['year' => $found['year'], 'track_no' => $isAlbum ? $found['track_no'] : null]),
            ...$this->set('spotify', $isAlbum ? self::SCORE_SPOTIFY : self::SCORE_LASTFM_ALBUM, ['album' => $found['album']]),
        ];
        if ($found['cover'] !== null) {
            $out[] = $this->cover($found['cover'], 'spotify', $found['cover_width']);
        }
        try {
            $genres = $this->spotify->artist($track->artist)['genres'] ?? [];
        } catch (Throwable) {
            $genres = [];
        }
        if ($genres !== []) {
            // Жанр Spotify — про виконавця, а не про пісню: довіра нижча.
            $out[] = ['field' => 'genre', 'value' => MusicBrainz::genreName((string) $genres[0]), 'source' => 'spotify', 'score' => self::SCORE_SPOTIFY - 20];
        }

        return $out;
    }

    /**
     * @return list<array{field: string, value: mixed, source: string, score: int|float}>
     */
    private function fromLastFm(Track $track, ?int $duration): array
    {
        if (! $this->lastfm->configured()) {
            return [];
        }
        $info = $this->lastfm->track($track->artist, $track->title, $track->mbid);
        if ($info === null || ! MetaMatch::sameArtist((string) ($info['artist']['name'] ?? ''), $track->artist)) {
            return [];
        }
        $length = (int) round(((int) ($info['duration'] ?? 0)) / 1000) ?: null;
        if (! MetaMatch::durationOk($length, $duration)) {
            return [];
        }
        $out = $this->set('lastfm', self::SCORE_LASTFM_ALBUM, ['album' => $info['album']['title'] ?? null]);
        foreach (array_slice(LastFm::genres($info), 0, 2) as $i => $genre) {
            $out[] = ['field' => 'genre', 'value' => $genre, 'source' => 'lastfm', 'score' => self::SCORE_LASTFM - 10 * $i];
        }

        return $out;
    }

    /**
     * Кандидат-обкладинка; дрібні зображення (менше 500 px) — з нижчою довірою.
     *
     * @return array{field: string, value: mixed, source: string, score: int|float}
     */
    private function cover(string $url, string $kind, ?int $width = null): array
    {
        $score = self::COVER_SCORES[$kind] - ($width !== null && $width < 500 ? 15 : 0);

        return ['field' => 'cover', 'value' => $url, 'source' => str_starts_with($kind, 'caa') ? 'coverartarchive' : $kind, 'score' => $score];
    }

    /**
     * @param  array<string, mixed>  $values
     * @return list<array{field: string, value: mixed, source: string, score: int|float}>
     */
    private function set(string $source, float $score, array $values): array
    {
        $out = [];
        foreach ($values as $field => $value) {
            if (filled($value)) {
                $out[] = ['field' => (string) $field, 'value' => $value, 'source' => $source, 'score' => $score];
            }
        }

        return $out;
    }
}
