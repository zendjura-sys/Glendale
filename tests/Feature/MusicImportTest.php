<?php

namespace Tests\Feature;

use App\Models\Track;
use App\Models\TrackImport;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Music\AudioProbe;
use App\Services\Music\ImportFailed;
use App\Services\Music\ShareLinks;
use App\Support\Net\PublicUrl;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** «Завантажити за посиланням»: пряме посилання, Google Диск, Dropbox, OneDrive і захист від внутрішніх адрес. */
class MusicImportTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        // Обмеження 10 запитів на хвилину тут заважало б перебрати багато посилань поспіль.
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->dir = sys_get_temp_dir().'/music-import-'.uniqid();
        @mkdir($this->dir);

        // DNS без мережі: «внутрішні» хости — на приватні адреси, решта — на публічну.
        $this->app->instance(PublicUrl::class, new PublicUrl(fn (string $host) => match ($host) {
            'intranet.example.com' => ['10.0.0.5'],
            'metadata.example.com' => ['169.254.169.254'],
            'nowhere.example.com' => [],
            default => ['93.184.216.34'],
        }));
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->dir.'/*') ?: []);
        @rmdir($this->dir);
        parent::tearDown();
    }

    /** Дві секунди синусоїди MP3 з тегами (потрібен ffmpeg). */
    private function mp3(bool $tags = true): string
    {
        if (! app(AudioProbe::class)->available()) {
            $this->markTestSkipped('ffmpeg/ffprobe не встановлено.');
        }
        $out = $this->dir.'/tone-'.uniqid().'.mp3';
        $meta = $tags ? ['-metadata', 'title=Teg Title', '-metadata', 'artist=Teg Artist'] : [];
        exec(implode(' ', array_map('escapeshellarg', ['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
            '-c:a', 'libmp3lame', '-b:a', '64k', ...$meta, $out])).' 2>&1', $output, $code);
        $this->assertSame(0, $code, implode("\n", $output));

        return (string) file_get_contents($out);
    }

    private function import(User $user, array $body)
    {
        return $this->actingAs($user)->postJson('/music/tracks/import', $body);
    }

    public function test_direct_link_lands_in_library_with_tags(): void
    {
        $audio = $this->mp3();
        Http::fake(['files.example.com/*' => Http::response($audio, 200, ['Content-Type' => 'audio/mpeg'])]);
        $user = User::factory()->create();

        $this->import($user, ['url' => 'https://files.example.com/music/song.mp3'])
            ->assertStatus(202)
            ->assertJsonPath('import.status', 'done')
            ->assertJsonPath('import.host', 'files.example.com')
            ->assertJsonPath('import.track.title', 'Teg Title')
            ->assertJsonPath('import.track.artist', 'Teg Artist');

        $track = Track::query()->sole();
        $this->assertSame($user->id, $track->user_id);
        $this->assertTrue(DB::table('music_library')->where(['user_id' => $user->id, 'track_id' => $track->id])->exists());
        Storage::disk('public')->assertExists($track->path);
        $this->assertStringEndsWith('.mp3', $track->path);
        $this->assertGreaterThan(0, $track->duration);
        // Теги — не від людини: збагачення метаданих може їх покращити.
        $this->assertSame('tags', $track->metadata_meta['title']['source'] ?? null);
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->header('User-Agent')[0] ?? '', 'GameConMusic'));

        $this->actingAs($user)->getJson('/music/imports')->assertOk()
            ->assertJsonPath('imports.0.status', 'done')
            ->assertJsonPath('imports.0.track.id', $track->id)
            ->assertJsonPath('imports.0.error', null);
    }

    public function test_user_hints_win_and_filename_is_used_without_tags(): void
    {
        $audio = $this->mp3(tags: false);
        // Щоразу нова відповідь: тіло — потік, другий запит прочитав би його вже порожнім.
        Http::fake(['files.example.com/*' => fn () => Http::response($audio, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="Nightdrive - Neon Run.mp3"',
        ])]);
        $user = User::factory()->create();

        $this->import($user, ['url' => 'https://files.example.com/get?id=5', 'album' => 'Run'])->assertStatus(202);
        $track = Track::query()->sole();
        $this->assertSame(['Neon Run', 'Nightdrive', 'Run'], [$track->title, $track->artist, $track->album]);
        $this->assertSame('filename', $track->metadata_meta['artist']['source'] ?? null);
        $this->assertSame(Track::SOURCE_USER, $track->metadata_meta['album']['source'] ?? null);

        $this->import($user, ['url' => 'https://files.example.com/get?id=6', 'title' => 'Моя назва', 'artist' => 'Я'])->assertStatus(202);
        $mine = Track::query()->latest('id')->first();
        $this->assertSame(['Моя назва', 'Я'], [$mine->title, $mine->artist]);
        $this->assertSame(Track::SOURCE_USER, $mine->metadata_meta['title']['source'] ?? null);
    }

    public function test_google_drive_link_including_virus_scan_confirm_page(): void
    {
        $audio = $this->mp3();
        $confirm = '<!DOCTYPE html><html><body><form id="download-form" action="https://drive.usercontent.google.com/download" method="get">'
            .'<input type="hidden" name="id" value="AbCdEfGhIjKlMn"><input type="hidden" name="export" value="download">'
            .'<input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="u-1"><input type="submit" value="Download anyway"></form></body></html>';
        Http::fake(function (HttpRequest $request) use ($audio, $confirm) {
            $url = $request->url();
            $this->assertStringStartsWith('https://drive.usercontent.google.com/download?', $url);

            return str_contains($url, 'confirm=t') && str_contains($url, 'uuid=u-1')
                ? Http::response($audio, 200, ['Content-Type' => 'application/octet-stream', 'Content-Disposition' => 'attachment; filename="drive.mp3"'])
                : Http::response($confirm, 200, ['Content-Type' => 'text/html; charset=utf-8']);
        });
        $user = User::factory()->create();

        $this->import($user, ['url' => 'https://drive.google.com/file/d/AbCdEfGhIjKlMn/view?usp=sharing'])
            ->assertStatus(202)->assertJsonPath('import.status', 'done')->assertJsonPath('import.host', 'drive.google.com');
        Http::assertSentCount(2);
        $this->assertSame(1, Track::query()->count());

        // open?id= і uc?id= — та сама пряма адреса.
        $links = new ShareLinks;
        foreach (['https://drive.google.com/open?id=AbCdEfGhIjKlMn', 'https://drive.google.com/uc?id=AbCdEfGhIjKlMn&export=download'] as $link) {
            $this->assertSame('https://drive.usercontent.google.com/download?id=AbCdEfGhIjKlMn&export=download', $links->resolve($link));
        }
    }

    public function test_dropbox_link_downloads_with_dl_and_keeps_rlkey(): void
    {
        $audio = $this->mp3();
        Http::fake([
            'www.dropbox.com/*' => Http::response('', 302, ['Location' => 'https://uc123.dl.dropboxusercontent.com/cd/0/get/abc/file']),
            'uc123.dl.dropboxusercontent.com/*' => Http::response($audio, 200, ['Content-Type' => 'audio/mpeg', 'Content-Disposition' => "attachment; filename*=UTF-8''Song%20One.mp3"]),
        ]);
        $user = User::factory()->create();

        $this->import($user, ['url' => 'https://www.dropbox.com/scl/fi/xyz/Song%20One.mp3?rlkey=secret1&dl=0'])
            ->assertStatus(202)->assertJsonPath('import.status', 'done');
        Http::assertSent(fn (HttpRequest $r) => str_contains($r->url(), 'www.dropbox.com') && str_contains($r->url(), 'rlkey=secret1') && str_contains($r->url(), 'dl=1'));
    }

    public function test_onedrive_link_uses_shares_api(): void
    {
        $audio = $this->mp3();
        $share = 'https://1drv.ms/u/s!AbCdEf123';
        $encoded = 'u!'.rtrim(strtr(base64_encode($share), '+/', '-_'), '=');
        Http::fake([
            'api.onedrive.com/*' => Http::response('', 302, ['Location' => 'https://public.bn.files.1drv.com/y4m/track.mp3']),
            'public.bn.files.1drv.com/*' => Http::response($audio, 200, ['Content-Type' => 'audio/mpeg']),
        ]);
        $user = User::factory()->create();

        $this->import($user, ['url' => $share])->assertStatus(202)->assertJsonPath('import.status', 'done');
        Http::assertSent(fn (HttpRequest $r) => $r->url() === "https://api.onedrive.com/v1.0/shares/{$encoded}/root/content");
    }

    public function test_private_cloud_file_reports_closed_access(): void
    {
        Http::fake([
            'drive.usercontent.google.com/*' => Http::response('', 302, ['Location' => 'https://accounts.google.com/ServiceLogin?continue=x']),
            'www.dropbox.com/*' => Http::response('<!DOCTYPE html><html><body>Sign in</body></html>', 200, ['Content-Type' => 'text/html']),
            'api.onedrive.com/*' => Http::response('{"error":{}}', 403),
        ]);
        $user = User::factory()->create();

        foreach (['https://drive.google.com/file/d/PrivateFile123/view', 'https://www.dropbox.com/s/abc/song.mp3', 'https://1drv.ms/u/s!Closed1'] as $url) {
            $this->import($user, ['url' => $url])->assertStatus(202)
                ->assertJsonPath('import.status', 'failed')
                ->assertJsonPath('import.error', ShareLinks::PRIVATE);
        }
        Http::assertNotSent(fn (HttpRequest $r) => str_contains($r->url(), 'accounts.google.com'));
        $this->assertSame(0, Track::query()->count());
    }

    public function test_html_page_and_garbage_are_not_audio(): void
    {
        Http::fake([
            'site.example.com/page' => Http::response('<html><body>Hi</body></html>', 200, ['Content-Type' => 'text/html']),
            'site.example.com/file.mp3' => Http::response(str_repeat('not audio at all ', 200), 200, ['Content-Type' => 'audio/mpeg']),
            'site.example.com/missing.mp3' => Http::response('nope', 404),
        ]);
        $user = User::factory()->create();

        $this->import($user, ['url' => 'https://site.example.com/page'])->assertJsonPath('import.error', ImportFailed::NOT_AUDIO);
        $this->import($user, ['url' => 'https://site.example.com/file.mp3'])->assertJsonPath('import.error', ImportFailed::NOT_AUDIO);
        $this->import($user, ['url' => 'https://site.example.com/missing.mp3'])->assertJsonPath('import.error', ImportFailed::NOT_FOUND);
        $this->assertSame(0, Track::query()->count());
    }

    public function test_oversized_file_is_rejected(): void
    {
        app(SiteSettings::class)->put(['music_max_track_mb' => 1]);
        Http::fake([
            'big.example.com/declared.mp3' => Http::response('x', 200, ['Content-Type' => 'audio/mpeg', 'Content-Length' => (string) (5 * 1024 * 1024)]),
            'big.example.com/streamed.mp3' => Http::response(str_repeat('a', 1024 * 1024 + 10), 200, ['Content-Type' => 'audio/mpeg']),
        ]);
        $user = User::factory()->create();

        foreach (['declared', 'streamed'] as $name) {
            $this->import($user, ['url' => "https://big.example.com/{$name}.mp3"])
                ->assertJsonPath('import.status', 'failed')->assertJsonPath('import.error', 'Файл завеликий (максимум 1 МБ).');
        }
    }

    public function test_private_addresses_are_rejected_including_redirects(): void
    {
        Http::fake([
            'jump.example.com/*' => Http::response('', 302, ['Location' => 'http://127.0.0.1/admin.mp3']),
            'hop.example.com/*' => Http::response('', 301, ['Location' => 'https://intranet.example.com/a.mp3']),
            '*' => Http::response('should not be reached', 200),
        ]);
        $user = User::factory()->create();

        foreach (['http://localhost/a.mp3', 'http://127.0.0.1/a.mp3', 'http://10.1.2.3/a.mp3', 'http://192.168.0.10/a.mp3',
            'http://[::1]/a.mp3', 'https://intranet.example.com/a.mp3', 'http://metadata.example.com/latest', 'https://user:pass@files.example.com/a.mp3'] as $url) {
            $this->import($user, ['url' => $url])->assertStatus(422)->assertJsonValidationErrors('url');
        }
        $this->import($user, ['url' => 'ftp://files.example.com/a.mp3'])->assertStatus(422)->assertJsonValidationErrors('url');

        $this->import($user, ['url' => 'https://jump.example.com/a.mp3'])
            ->assertJsonPath('import.status', 'failed')->assertJsonPath('import.error', ImportFailed::address(PublicUrl::PRIVATE));
        $this->import($user, ['url' => 'https://hop.example.com/a.mp3'])
            ->assertJsonPath('import.error', ImportFailed::address(PublicUrl::PRIVATE));
        Http::assertNotSent(fn (HttpRequest $r) => in_array(parse_url($r->url(), PHP_URL_HOST), ['127.0.0.1', 'intranet.example.com', 'localhost'], true));
    }

    public function test_too_many_redirects_fail(): void
    {
        Http::fake(['loop.example.com/*' => Http::response('', 302, ['Location' => '/again'])]);
        $user = User::factory()->create();

        $this->import($user, ['url' => 'https://loop.example.com/a.mp3'])->assertJsonPath('import.error', ImportFailed::REDIRECTS);
    }

    public function test_streaming_pages_and_terabox_are_refused_upfront(): void
    {
        Http::fake();
        $user = User::factory()->create();

        foreach (['https://www.youtube.com/watch?v=abc', 'https://youtu.be/abc', 'https://music.youtube.com/watch?v=abc', 'https://open.spotify.com/track/1',
            'https://soundcloud.com/a/b', 'https://music.apple.com/ua/album/x/1', 'https://www.deezer.com/track/1', 'https://www.tiktok.com/@a/video/1',
            'https://www.instagram.com/reel/1'] as $url) {
            $this->import($user, ['url' => $url])->assertStatus(422)->assertJsonPath('errors.url.0', ShareLinks::STREAMING);
        }
        foreach (['https://www.terabox.com/s/1abc', 'https://1024terabox.com/s/1abc', 'https://mega.nz/file/abc#key'] as $url) {
            $this->import($user, ['url' => $url])->assertStatus(422)->assertJsonPath('errors.url.0', ShareLinks::NO_DIRECT);
        }
        Http::assertNothingSent();
        $this->assertSame(0, TrackImport::query()->count());
    }

    public function test_at_most_three_active_imports_per_user(): void
    {
        $user = User::factory()->create();
        foreach (range(1, 3) as $i) {
            TrackImport::query()->create(['user_id' => $user->id, 'url' => "https://files.example.com/{$i}.mp3", 'host' => 'files.example.com', 'status' => TrackImport::DOWNLOADING]);
        }

        $this->import($user, ['url' => 'https://files.example.com/4.mp3'])->assertStatus(422)->assertJsonValidationErrors('url');

        // Завислі (без змін понад STALE_MINUTES) звільняють місце.
        TrackImport::query()->whereKey(TrackImport::query()->min('id'))->update(['updated_at' => now()->subHour()]);
        Http::fake(['files.example.com/*' => Http::response('<html></html>', 200, ['Content-Type' => 'text/html'])]);
        $this->import($user, ['url' => 'https://files.example.com/4.mp3'])->assertStatus(202);
        $this->assertSame(ImportFailed::STALE, TrackImport::query()->orderBy('id')->first()->error);
    }

    public function test_imports_are_private_to_their_owner(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $done = TrackImport::query()->create(['user_id' => $owner->id, 'url' => 'https://files.example.com/a.mp3', 'host' => 'files.example.com', 'status' => TrackImport::FAILED, 'error' => 'x']);
        $active = TrackImport::query()->create(['user_id' => $owner->id, 'url' => 'https://files.example.com/b.mp3', 'host' => 'files.example.com', 'status' => TrackImport::PENDING]);

        $this->actingAs($other)->getJson('/music/imports')->assertOk()->assertJsonCount(0, 'imports');
        $this->actingAs($other)->deleteJson("/music/imports/{$done->id}")->assertNotFound();
        $this->assertModelExists($done);

        $this->actingAs($owner)->getJson('/music/imports')->assertOk()->assertJsonCount(2, 'imports')->assertJsonPath('imports.0.id', $active->id);
        $this->actingAs($owner)->deleteJson("/music/imports/{$active->id}")->assertStatus(422);
        $this->actingAs($owner)->deleteJson("/music/imports/{$done->id}")->assertOk();
        $this->assertModelMissing($done);
    }

    public function test_deleting_a_finished_import_keeps_the_track(): void
    {
        $audio = $this->mp3();
        Http::fake(['files.example.com/*' => Http::response($audio, 200, ['Content-Type' => 'audio/mpeg'])]);
        $user = User::factory()->create();

        $id = $this->import($user, ['url' => 'https://files.example.com/keep.mp3'])->assertStatus(202)->json('import.id');
        $this->actingAs($user)->deleteJson("/music/imports/{$id}")->assertOk();
        $this->assertSame(1, Track::query()->count());
    }

    public function test_app_bridge_has_the_same_import_routes(): void
    {
        Http::fake(['files.example.com/*' => Http::response('<html></html>', 200, ['Content-Type' => 'text/html'])]);
        $user = User::factory()->create();
        $token = app(ApiTokens::class)->issue($user, 'android');

        $id = $this->withToken($token)->postJson('/api/v1/site/music/tracks/import', ['url' => 'https://files.example.com/a.mp3'])
            ->assertStatus(202)->assertJsonStructure(['import' => ['id', 'url', 'host', 'status', 'error', 'progress', 'track', 'created_at']])
            ->json('import.id');
        $this->withToken($token)->getJson('/api/v1/site/music/imports')->assertOk()->assertJsonPath('imports.0.id', $id);
        $this->withToken($token)->postJson('/api/v1/site/music/tracks/import', ['url' => 'https://youtu.be/x'])->assertStatus(422);
        $this->withToken($token)->deleteJson("/api/v1/site/music/imports/{$id}")->assertOk();
    }
}
