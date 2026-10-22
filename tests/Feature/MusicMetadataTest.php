<?php

namespace Tests\Feature;

use App\Jobs\EnrichTrackMetadata;
use App\Models\Track;
use App\Models\User;
use App\Services\Music\ArtistInfo;
use App\Services\Music\AudioProbe;
use App\Services\Music\MetadataEnricher;
use App\Services\Music\MetaMatch;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Метадані треків з кількох джерел разом: AcoustID → MusicBrainz, пошук MusicBrainz, Discogs, Spotify,
 * Last.fm, Cover Art Archive, LRCLIB; вибір за довірою, введене користувачем — недоторканне; getID3 без ffprobe.
 */
class MusicMetadataTest extends TestCase
{
    use RefreshDatabase;

    private const REC = '11111111-1111-1111-1111-111111111111';

    private const RELEASE = '22222222-2222-2222-2222-222222222222';

    private const GROUP = '33333333-3333-3333-3333-333333333333';

    private const ARTIST = '44444444-4444-4444-4444-444444444444';

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        config([
            'services.music_metadata.enabled' => true,
            'services.musicbrainz.interval_ms' => 0,
            'services.discogs.interval_ms' => 0,
            'services.spotify.accounts_url' => 'https://accounts.spotify.com',
            'services.spotify.api_url' => 'https://api.spotify.com/v1',
        ]);
        $this->dir = sys_get_temp_dir().'/music-meta-'.uniqid();
        @mkdir($this->dir);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->dir.'/*') ?: []);
        @rmdir($this->dir);
        parent::tearDown();
    }

    private function track(array $attributes = [], array $meta = []): Track
    {
        Storage::disk('public')->put('music/song.mp3', 'not really audio');

        return Track::query()->create([
            'title' => 'Neon Rain',
            'artist' => 'Nightdrive',
            'duration' => 200,
            'path' => 'music/song.mp3',
            'mime' => 'audio/mpeg',
            'size' => 16,
            'metadata_meta' => array_map(fn ($source) => ['source' => $source[0], 'score' => $source[1]], $meta) ?: null,
            ...$attributes,
        ]);
    }

    private function jpeg(int $size = 600): string
    {
        $image = imagecreatetruecolor($size, $size);
        ob_start();
        imagejpeg($image);

        return (string) ob_get_clean();
    }

    /**
     * Фейк мережі за шаблонами адрес (Str::is), решта — 404.
     *
     * @param  array<string, mixed>  $routes
     */
    private function fakeHttp(array $routes): void
    {
        Http::fake(function (Request $request) use ($routes) {
            foreach ($routes as $pattern => $response) {
                if (Str::is($pattern, $request->url())) {
                    return is_callable($response) ? $response($request) : $response;
                }
            }

            return Http::response('', 404);
        });
    }

    private function image(): mixed
    {
        return Http::response($this->jpeg(), 200, ['Content-Type' => 'image/jpeg']);
    }

    private function mbRecording(string $album, string $date, int $number, int $score = 100): array
    {
        return [
            'id' => self::REC, 'score' => $score, 'title' => 'Neon Rain', 'length' => 201000,
            'artist-credit' => [['name' => 'Nightdrive', 'artist' => ['id' => self::ARTIST, 'name' => 'Nightdrive']]],
            'tags' => [['name' => 'synthwave', 'count' => 3], ['name' => 'electronic', 'count' => 1]],
            'releases' => [
                ['id' => 'aaaaaaaa-0000-0000-0000-000000000000', 'title' => 'Hits Compilation', 'status' => 'Official', 'date' => '2015',
                    'release-group' => ['id' => 'bbbbbbbb-0000-0000-0000-000000000000', 'primary-type' => 'Album', 'secondary-types' => ['Compilation']]],
                ['id' => self::RELEASE, 'title' => $album, 'status' => 'Official', 'date' => $date,
                    'release-group' => ['id' => self::GROUP, 'primary-type' => 'Album'],
                    'media' => [['position' => 1, 'track' => [['number' => (string) $number, 'title' => 'Neon Rain']]]]],
            ],
        ];
    }

    private function configureSpotify(): void
    {
        app(SiteSettings::class)->put(['spotify_client_id' => 'abcdefghijklmnopqrstuvwxyz012345']);
        app(SiteSettings::class)->putSecret('spotify_client_secret', 'ZYXWVUTSRQPONMLKJIHGFEDCBA987654');
    }

    public function test_musicbrainz_fills_only_empty_fields_cover_and_lyrics(): void
    {
        $this->fakeHttp([
            '*musicbrainz.org/ws/2/recording?*' => Http::response(['recordings' => [$this->mbRecording('Night Album', '2019-04-01', 4)]]),
            'https://coverartarchive.org/release/'.self::RELEASE.'/front-500' => $this->image(),
            '*lrclib.net/api/get*' => Http::response(['plainLyrics' => 'Дощ із неону']),
        ]);
        $track = $this->track(['album' => 'Мій альбом'], ['title' => ['user', 100], 'artist' => ['user', 100], 'album' => ['user', 100]]);

        app(MetadataEnricher::class)->enrich($track);
        $track->refresh();

        // Альбом користувача не чіпаємо, решту — з найранішого офіційного альбому (не збірки).
        $this->assertSame('Мій альбом', $track->album);
        $this->assertSame(2019, $track->year);
        $this->assertSame(4, $track->track_no);
        $this->assertSame('Synthwave', $track->genre);
        $this->assertSame(self::REC, $track->mbid);
        $this->assertSame(self::RELEASE, $track->release_mbid);
        $this->assertSame(self::ARTIST, $track->artist_mbid);
        $this->assertSame('Дощ із неону', $track->lyrics);
        $this->assertNotNull($track->cover_path);
        Storage::disk('public')->assertExists($track->cover_path);
        $this->assertSame('coverartarchive', $track->fieldMeta('cover')['source']);
        $this->assertSame('musicbrainz', $track->fieldMeta('year')['source']);
        $this->assertSame('lrclib', $track->fieldMeta('lyrics')['source']);
        $this->assertSame('musicbrainz', $track->metadata_source);
        $this->assertNotNull($track->enriched_at);
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'musicbrainz.org') && $r->header('User-Agent')[0] === 'GameCon/1.0 (https://gamecon.online)');
    }

    public function test_acoustid_fingerprint_beats_conflicting_search_result(): void
    {
        // «fpcalc» — скрипт, що віддає готовий відбиток (на сервері це Chromaprint).
        $fpcalc = $this->dir.'/fpcalc';
        file_put_contents($fpcalc, "#!/bin/sh\necho '{\"duration\": 201.2, \"fingerprint\": \"AQADtEmUKEqi\"}'\n");
        chmod($fpcalc, 0755);
        config(['services.chromaprint.fpcalc' => $fpcalc]);
        app()->forgetInstance(AudioProbe::class);
        app(SiteSettings::class)->putSecret('acoustid_key', 'testkey123');

        $this->fakeHttp([
            'https://api.acoustid.org/v2/lookup' => Http::response(['status' => 'ok', 'results' => [['score' => 0.98, 'recordings' => [
                ['id' => self::REC, 'title' => 'Neon Rain', 'duration' => 201, 'artists' => [['id' => self::ARTIST, 'name' => 'Nightdrive']]],
            ]]]]),
            '*musicbrainz.org/ws/2/recording/'.self::REC.'*' => Http::response($this->mbRecording('True Album', '2018-01-01', 7)),
            // Пошук знаходить той самий запис, але з іншим «найранішим» релізом — довіра нижча.
            '*musicbrainz.org/ws/2/recording?*' => Http::response(['recordings' => [[...$this->mbRecording('Wrong Album', '2010-01-01', 1), 'id' => 'ffffffff-0000-0000-0000-000000000000']]]),
            '*coverartarchive.org/*' => Http::response('', 404),
        ]);
        $track = $this->track([], ['title' => ['user', 100], 'artist' => ['user', 100]]);

        app(MetadataEnricher::class)->enrich($track);
        $track->refresh();

        $this->assertSame('True Album', $track->album);
        $this->assertSame(2018, $track->year);
        $this->assertSame(7, $track->track_no);
        $this->assertSame(self::REC, $track->mbid);
        $this->assertSame('acoustid', $track->fieldMeta('album')['source']);
        $this->assertSame('acoustid', $track->metadata_source);
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'acoustid.org') && $r['client'] === 'testkey123' && $r['fingerprint'] === 'AQADtEmUKEqi');
    }

    public function test_spotify_fills_in_when_musicbrainz_finds_nothing(): void
    {
        $this->configureSpotify();
        $this->fakeHttp([
            '*musicbrainz.org/*' => Http::response(['recordings' => []]),
            'https://accounts.spotify.com/api/token' => Http::response(['access_token' => 'app-token', 'expires_in' => 3600]),
            'https://api.spotify.com/v1/search*' => fn (Request $r) => $r['type'] === 'artist'
                ? Http::response(['artists' => ['items' => [['id' => 'sp1', 'name' => 'Nightdrive', 'genres' => ['synthwave'], 'images' => [], 'followers' => ['total' => 5]]]]])
                : Http::response(['tracks' => ['items' => [[
                    'id' => 't1', 'name' => 'Neon Rain', 'duration_ms' => 199000, 'track_number' => 2,
                    'artists' => [['id' => 'sp1', 'name' => 'Nightdrive']],
                    'album' => ['name' => 'Sky', 'album_type' => 'album', 'release_date' => '2015-05-01',
                        'images' => [['url' => 'https://i.scdn.co/image/big', 'width' => 640], ['url' => 'https://i.scdn.co/image/small', 'width' => 64]]],
                ]]]]),
            'https://i.scdn.co/image/big' => $this->image(),
        ]);
        $track = $this->track([], ['title' => ['user', 100], 'artist' => ['user', 100]]);

        app(MetadataEnricher::class)->enrich($track);
        $track->refresh();

        $this->assertSame('Sky', $track->album);
        $this->assertSame(2015, $track->year);
        $this->assertSame(2, $track->track_no);
        $this->assertSame('Synthwave', $track->genre);
        $this->assertSame('spotify', $track->fieldMeta('cover')['source']);
        $this->assertSame('spotify', $track->metadata_source);
        $this->assertNull($track->mbid);
    }

    public function test_discogs_and_lastfm_agree_on_genre(): void
    {
        app(SiteSettings::class)->putSecret('discogs_token', 'discogstoken1234567890');
        app(SiteSettings::class)->putSecret('lastfm_key', str_repeat('a', 32));
        $this->fakeHttp([
            '*musicbrainz.org/*' => Http::response(['recordings' => []]),
            'https://api.discogs.com/database/search*' => Http::response(['results' => [['id' => 10, 'year' => 2010]]]),
            'https://api.discogs.com/releases/10' => Http::response([
                'id' => 10, 'title' => 'Disc Album', 'year' => 2010, 'country' => 'UA',
                'artists' => [['name' => 'Nightdrive (2)']], 'labels' => [['name' => 'Neon Records']],
                'styles' => ['Synthwave'], 'genres' => ['Electronic'],
                'tracklist' => [['position' => '1', 'title' => 'Intro', 'duration' => '1:00'], ['position' => '3', 'title' => 'Neon Rain', 'duration' => '3:22', 'type_' => 'track']],
                'images' => [['type' => 'primary', 'uri' => 'https://i.discogs.com/cover.jpg', 'width' => 600]],
            ]),
            'https://i.discogs.com/cover.jpg' => $this->image(),
            'https://ws.audioscrobbler.com/2.0/*' => Http::response(['track' => [
                'name' => 'Neon Rain', 'duration' => '200000', 'artist' => ['name' => 'Nightdrive'], 'album' => ['title' => 'Other Album'],
                'toptags' => ['tag' => [['name' => 'seen live'], ['name' => 'synthwave'], ['name' => 'retro']]],
            ]]),
        ]);
        $track = $this->track([], ['title' => ['user', 100], 'artist' => ['user', 100]]);

        app(MetadataEnricher::class)->enrich($track);
        $track->refresh();

        // Discogs надійніший за Last.fm щодо альбому; жанр підтверджують обидва — бонус.
        $this->assertSame('Disc Album', $track->album);
        $this->assertSame(3, $track->track_no);
        $this->assertSame('Synthwave', $track->genre);
        $this->assertEqualsWithDelta(MetadataEnricher::SCORE_DISCOGS + MetaMatch::AGREEMENT_BONUS, $track->fieldMeta('genre')['score'], 0.01);
        $this->assertSame('discogs', $track->fieldMeta('cover')['source']);
        Http::assertSent(fn (Request $r) => str_contains($r->url(), 'api.discogs.com') && $r->header('User-Agent')[0] === 'GameCon/1.0 +https://gamecon.online');
    }

    public function test_merge_rules_confidence_agreement_and_user_fields(): void
    {
        $winners = MetaMatch::pick([
            ['field' => 'album', 'value' => 'A', 'source' => 'musicbrainz', 'score' => 80],
            ['field' => 'album', 'value' => 'B', 'source' => 'spotify', 'score' => 65],
            ['field' => 'genre', 'value' => 'Pop', 'source' => 'spotify', 'score' => 55],
            ['field' => 'genre', 'value' => 'rock', 'source' => 'tags', 'score' => 40],
            ['field' => 'genre', 'value' => 'Rock', 'source' => 'lastfm', 'score' => 50],
            ['field' => 'artist', 'value' => 'Beyoncé feat. Jay-Z', 'source' => 'tags', 'score' => 40],
            ['field' => 'artist', 'value' => 'Beyonce', 'source' => 'spotify', 'score' => 65],
        ]);
        $this->assertSame('A', $winners['album']['value']);
        $this->assertSame(60.0, $winners['genre']['score']);
        $this->assertSame(['lastfm', 'tags'], $winners['genre']['sources']);
        $this->assertSame(75.0, $winners['artist']['score']);
        $this->assertTrue(MetaMatch::sameArtist('Daft Punk ft. Pharrell', 'daft punk'));
        $this->assertFalse(MetaMatch::sameArtist('Daft Punk', 'Justice'));

        $track = $this->track(['album' => 'Old', 'genre' => 'Мій жанр', 'year' => 1999], ['album' => ['tags', 40], 'genre' => ['user', 100]]);
        $enricher = app(MetadataEnricher::class);
        $enricher->apply($track, [
            ['field' => 'album', 'value' => 'Worse', 'source' => 'lastfm', 'score' => 35],
            ['field' => 'genre', 'value' => 'Jazz', 'source' => 'musicbrainz', 'score' => 95],
            // Рік без відомого походження (старий трек) — як введений користувачем.
            ['field' => 'year', 'value' => 2005, 'source' => 'musicbrainz', 'score' => 95],
        ]);
        $this->assertSame('Old', $track->fresh()->album);

        $enricher->apply($track, [['field' => 'album', 'value' => 'New', 'source' => 'musicbrainz', 'score' => 80]]);
        $track->refresh();
        $this->assertSame('New', $track->album);
        $this->assertSame('Мій жанр', $track->genre);
        $this->assertSame(1999, $track->year);

        // Користувач відредагував альбом — тепер це його значення.
        $this->actingAs(User::factory()->admin()->create())->patchJson(route('tracks.update', $track), ['title' => $track->title, 'artist' => $track->artist, 'album' => 'Ручний', 'genre' => 'Мій жанр'])->assertOk();
        $enricher->apply($track->refresh(), [['field' => 'album', 'value' => 'Auto', 'source' => 'acoustid', 'score' => 99]]);
        $this->assertSame('Ручний', $track->fresh()->album);
        $this->assertSame('user', $track->fresh()->fieldMeta('album')['source']);
    }

    public function test_better_cover_replaces_auto_cover_but_never_user_cover(): void
    {
        $this->fakeHttp(['https://coverartarchive.org/*' => $this->image()]);
        $caa = ['field' => 'cover', 'value' => 'https://coverartarchive.org/release/'.self::RELEASE.'/front-500', 'source' => 'coverartarchive', 'score' => 90];

        Storage::disk('public')->put('music/covers/embedded.jpg', $this->jpeg(100));
        $auto = $this->track(['cover_path' => 'music/covers/embedded.jpg'], ['cover' => ['tags', 40]]);
        app(MetadataEnricher::class)->apply($auto, [$caa]);
        $auto->refresh();
        $this->assertNotSame('music/covers/embedded.jpg', $auto->cover_path);
        $this->assertSame('coverartarchive', $auto->fieldMeta('cover')['source']);
        Storage::disk('public')->assertExists($auto->cover_path);
        Storage::disk('public')->assertMissing('music/covers/embedded.jpg');

        // Слабша обкладинка не замінює кращу.
        $best = $auto->cover_path;
        app(MetadataEnricher::class)->apply($auto, [['field' => 'cover', 'value' => 'https://coverartarchive.org/x', 'source' => 'spotify', 'score' => 70]]);
        $this->assertSame($best, $auto->fresh()->cover_path);

        Storage::disk('public')->put('music/covers/mine.jpg', $this->jpeg(100));
        $mine = $this->track(['cover_path' => 'music/covers/mine.jpg'], ['cover' => ['user', 100]]);
        app(MetadataEnricher::class)->apply($mine, [$caa]);
        $this->assertSame('music/covers/mine.jpg', $mine->fresh()->cover_path);
        Storage::disk('public')->assertExists('music/covers/mine.jpg');
    }

    public function test_everything_failing_changes_nothing(): void
    {
        $this->configureSpotify();
        app(SiteSettings::class)->putSecret('discogs_token', 'discogstoken1234567890');
        app(SiteSettings::class)->putSecret('lastfm_key', str_repeat('a', 32));
        Http::fake(fn () => Http::response('Server error', 500));
        $track = $this->track(['album' => 'Свій'], ['album' => ['user', 100]]);

        $this->assertSame([], app(MetadataEnricher::class)->enrich($track));
        $track->refresh();
        $this->assertSame('Свій', $track->album);
        $this->assertNull($track->genre);
        $this->assertNull($track->cover_path);
        $this->assertNotNull($track->enriched_at);

        // Без зовнішніх запитів (MUSIC_METADATA=false) — нічого не робимо взагалі.
        config(['services.music_metadata.enabled' => false]);
        $other = $this->track();
        $this->assertSame([], app(MetadataEnricher::class)->enrich($other));
        $this->assertNull($other->fresh()->enriched_at);
    }

    public function test_namesake_artist_is_rejected_and_card_uses_resolved_image(): void
    {
        $this->configureSpotify();
        $this->fakeHttp([
            '*musicbrainz.org/ws/2/artist?*' => Http::response(['artists' => [['id' => self::ARTIST, 'name' => 'Nightdrive', 'score' => 100]]]),
            '*musicbrainz.org/ws/2/artist/'.self::ARTIST.'*' => Http::response([
                'id' => self::ARTIST, 'name' => 'Nightdrive', 'type' => 'Group', 'life-span' => ['begin' => '2014'],
                'begin-area' => ['name' => 'Київ'], 'genres' => [['name' => 'synthwave', 'count' => 4]],
                'relations' => [
                    ['type' => 'wikidata', 'url' => ['resource' => 'https://www.wikidata.org/wiki/Q2']],
                    ['type' => 'free streaming', 'url' => ['resource' => 'https://open.spotify.com/artist/REAL']],
                ],
            ]),
            // Вікіпедія знаходить тезку (інший елемент Wikidata).
            'https://uk.wikipedia.org/w/api.php*' => Http::response(['query' => ['search' => [['title' => 'Nightdrive']]]]),
            'https://uk.wikipedia.org/api/rest_v1/page/summary/Nightdrive' => Http::response([
                'type' => 'standard', 'description' => 'американський рок-гурт', 'extract' => 'Тезка з Огайо.',
                'originalimage' => ['source' => 'https://upload.wikimedia.org/namesake.jpg'], 'wikibase_item' => 'Q1',
            ]),
            'https://www.wikidata.org/w/api.php*' => fn (Request $r) => match (true) {
                $r['props'] === 'sitelinks' => Http::response(['entities' => ['Q2' => ['sitelinks' => ['enwiki' => ['title' => 'Nightdrive (band)']]]]]),
                $r['props'] === 'claims' => Http::response(['entities' => ['Q2' => ['claims' => [
                    'P434' => [['mainsnak' => ['datavalue' => ['value' => self::ARTIST]]]],
                    'P571' => [['mainsnak' => ['datavalue' => ['value' => ['time' => '+2014-00-00T00:00:00Z']]]]],
                ]]]]),
                default => Http::response([]),
            },
            'https://en.wikipedia.org/api/rest_v1/page/summary/Nightdrive_%28band%29' => Http::response([
                'type' => 'standard', 'description' => 'Ukrainian synthwave band', 'extract' => 'Справжній Nightdrive.',
                'originalimage' => ['source' => 'https://upload.wikimedia.org/real.jpg'], 'wikibase_item' => 'Q2',
            ]),
            'https://accounts.spotify.com/api/token' => Http::response(['access_token' => 'app-token', 'expires_in' => 3600]),
            // Spotify знаходить інший акаунт з тим самим ім'ям — MusicBrainz посилається на REAL.
            'https://api.spotify.com/v1/search*' => Http::response(['artists' => ['items' => [
                ['id' => 'FAKE', 'name' => 'Nightdrive', 'genres' => ['country'], 'images' => [['url' => 'https://i.scdn.co/image/fake']], 'followers' => ['total' => 9]],
            ]]]),
        ]);

        $info = app(ArtistInfo::class)->get('Nightdrive');

        $this->assertSame('Справжній Nightdrive.', $info['bio']);
        $this->assertSame('https://upload.wikimedia.org/real.jpg', $info['image_url']);
        $this->assertNull($info['spotify_url']);
        $this->assertNotContains('Country', $info['genres']);
        $this->assertSame('Synthwave', $info['genres'][0]);
        $this->assertSame('Київ', $info['origin']);
        $this->assertSame('2014-00-00', $info['formed']);
        $this->assertSame(self::ARTIST, $info['mbid']);

        // Картки й сторінка виконавця беруть фото з кешу — без мережі.
        Http::fake(fn () => throw new \RuntimeException('Мережа під час відкриття сторінки'));
        $track = $this->track(['processing' => false]);
        $this->actingAs(User::factory()->create())->get('/music/artist?name=Nightdrive')->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('artist.name', 'Nightdrive')
                ->where('artist.cover_url', 'https://upload.wikimedia.org/real.jpg'));
        $this->assertNotNull($track->id);
    }

    public function test_getid3_reads_files_without_ffprobe(): void
    {
        exec('command -v ffmpeg', $out, $code);
        if ($code !== 0) {
            $this->markTestSkipped('ffmpeg не встановлено — нічим згенерувати тестовий файл.');
        }
        $flac = $this->dir.'/hires.flac';
        $mp3 = $this->dir.'/cover.mp3';
        $sine = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2:sample_rate=96000'];
        exec(implode(' ', array_map('escapeshellarg', ['ffmpeg', '-v', 'error', '-y', ...$sine, '-c:a', 'flac', '-sample_fmt', 's32', '-bits_per_raw_sample', '24',
            '-metadata', 'album=Глибина', '-metadata', 'date=2024-03-01', '-metadata', 'track=3/10', '-metadata', 'genre=Ambient', $flac])));
        exec(implode(' ', array_map('escapeshellarg', ['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2:sample_rate=44100',
            '-f', 'lavfi', '-i', 'color=c=indigo:s=64x64:d=1', '-map', '0:a', '-map', '1:v', '-frames:v', '1', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic',
            '-c:a', 'libmp3lame', '-b:a', '192k', '-id3v2_version', '3', '-metadata', 'album=Обкладинка', $mp3])));

        config(['services.ffmpeg.ffprobe' => '/nonexistent/ffprobe', 'services.ffmpeg.ffmpeg' => '/nonexistent/ffmpeg']);
        app()->forgetInstance(AudioProbe::class);
        $this->assertFalse(app(AudioProbe::class)->available());
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('tracks.store'), [
            'audio' => new UploadedFile($flac, 'hires.flac', null, null, true), 'title' => 'Сигнал', 'artist' => 'Тест',
        ])->assertCreated();
        $track = Track::query()->latest('id')->firstOrFail();
        $this->assertSame('flac', $track->codec);
        $this->assertSame(96000, $track->sample_rate);
        $this->assertSame(24, $track->bit_depth);
        $this->assertSame(Track::QUALITY_HIRES, $track->quality);
        $this->assertSame('Глибина', $track->album);
        $this->assertSame(2024, $track->year);
        $this->assertSame(3, $track->track_no);
        $this->assertSame('Ambient', $track->genre);
        $this->assertSame('tags', $track->fieldMeta('album')['source']);
        $this->assertSame('Сигнал', $track->title);
        $this->assertNull($track->stream_path);
        $this->assertFalse($track->processing);

        $this->actingAs($user)->post(route('tracks.store'), [
            'audio' => new UploadedFile($mp3, 'cover.mp3', null, null, true), 'title' => 'Обкладинка', 'artist' => 'Тест',
        ])->assertCreated();
        $track = Track::query()->latest('id')->firstOrFail();
        $this->assertSame('mp3', $track->codec);
        $this->assertSame(Track::QUALITY_LOSSY, $track->quality);
        $this->assertNotNull($track->cover_path);
        Storage::disk('public')->assertExists($track->cover_path);
    }

    public function test_admin_status_block_and_enrich_action(): void
    {
        $admin = User::factory()->admin()->create();
        $this->track();
        $this->track(['enriched_at' => now()]);

        $this->actingAs($admin)->get(route('admin.music.index'))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('admin/music')
            ->where('metadata.online', true)
            ->where('metadata.pending', 1)
            ->where('metadata.sources.1.key', 'getid3')
            ->where('metadata.sources.1.status', 'ok')
            ->where('metadata.sources.3.key', 'acoustid')
            ->where('metadata.sources.3.status', 'missing')
            ->where('metadata.sources.7.status', 'public'));

        Queue::fake();
        $this->actingAs(User::factory()->create())->post(route('admin.music.enrich'))->assertForbidden();
        Queue::assertNothingPushed();

        $this->actingAs($admin)->post(route('admin.music.enrich'))->assertRedirect();
        Queue::assertPushed(EnrichTrackMetadata::class, 1);
        // «Усі»: додається й уже оброблений трек; той, що вже в черзі, вдруге не ставиться (ShouldBeUnique).
        $this->actingAs($admin)->post(route('admin.music.enrich'), ['all' => true]);
        Queue::assertPushed(EnrichTrackMetadata::class, 2);
    }

    public function test_integrations_cards_and_enrich_command(): void
    {
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->put(route('admin.integrations.cinema', 'acoustid'), ['key' => 'abc123XYZ'])->assertSessionHasNoErrors();
        $this->assertSame('abc123XYZ', app(SiteSettings::class)->secret('acoustid_key'));
        $this->assertArrayNotHasKey('acoustid_key', app(SiteSettings::class)->public());
        $this->actingAs($admin)->put(route('admin.integrations.cinema', 'lastfm'), ['key' => 'not-hex'])->assertSessionHasErrors('key');

        $this->actingAs($admin)->get(route('admin.integrations.index'))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('cinema', fn ($cards) => collect($cards)->where('group', 'music')->pluck('key')->sort()->values()->all() === ['acoustid', 'discogs', 'lastfm']));

        Http::fake(['https://api.acoustid.org/*' => Http::response(['status' => 'error', 'error' => ['code' => 4, 'message' => 'invalid API key']])]);
        $this->actingAs($admin)->post(route('admin.integrations.cinema.test', 'acoustid'))->assertSessionHas('inertia.flash_data.toast.type', 'error');

        Http::fake(fn () => Http::response([], 404));
        $first = $this->track();
        $this->track();
        $this->artisan('music:enrich', ['--limit' => 1])->assertSuccessful();
        $this->assertNotNull($first->fresh()->enriched_at);
        $this->assertSame(1, Track::query()->whereNull('enriched_at')->count());
    }
}
