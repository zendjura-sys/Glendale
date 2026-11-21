<?php

namespace Tests\Feature;

use App\Models\Track;
use App\Models\User;
use App\Services\Music\AudioProbe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** «Кодеки: все»: розбір файлу через ffprobe, значки якості й копія AAC для форматів, що не грають у браузері. */
class MusicCodecsTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->dir = sys_get_temp_dir().'/music-codecs-'.uniqid();
        @mkdir($this->dir);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->dir.'/*') ?: []);
        @rmdir($this->dir);
        parent::tearDown();
    }

    private function requireFfmpeg(): void
    {
        if (! app(AudioProbe::class)->available()) {
            $this->markTestSkipped('ffmpeg/ffprobe не встановлено.');
        }
    }

    /** Секунда синусоїди у потрібному форматі (аргументи ffmpeg для виходу). */
    private function audio(string $name, array $args, int $rate = 44100, bool $cover = false): string
    {
        $out = $this->dir.'/'.$name;
        $input = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1:sample_rate='.$rate];
        if ($cover) {
            $input = [...$input, '-f', 'lavfi', '-i', 'color=c=indigo:s=64x64:d=1', '-map', '0:a', '-map', '1:v', '-frames:v', '1', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic'];
        }
        exec(implode(' ', array_map('escapeshellarg', ['ffmpeg', '-v', 'error', '-y', ...$input, ...$args, $out])).' 2>&1', $output, $code);
        $this->assertSame(0, $code, implode("\n", $output));

        return $out;
    }

    private function upload(User $user, string $file, array $fields = []): Track
    {
        $this->actingAs($user)->post(route('tracks.store'), [
            'audio' => new UploadedFile($file, basename($file), null, null, true),
            'title' => 'Сигнал',
            'artist' => 'Тест',
            ...$fields,
        ])->assertCreated();

        return Track::query()->latest('id')->firstOrFail();
    }

    public function test_quality_rules(): void
    {
        $this->assertSame(Track::QUALITY_LOSSY, AudioProbe::quality('aac', 48000, null));
        $this->assertSame(Track::QUALITY_LOSSY, AudioProbe::quality('mp3', 96000, null));
        $this->assertSame(Track::QUALITY_LOSSLESS, AudioProbe::quality('flac', 44100, 16));
        $this->assertSame(Track::QUALITY_LOSSLESS, AudioProbe::quality('alac', 48000, 24));
        $this->assertSame(Track::QUALITY_HIRES, AudioProbe::quality('flac', 96000, 24));
        $this->assertSame(Track::QUALITY_HIRES, AudioProbe::quality('pcm_f32le', 44100, 32));
        $this->assertSame(Track::QUALITY_HIRES, AudioProbe::quality('dsd_lsbf', 2822400, 1));
    }

    public function test_hires_flac_gets_codec_data_and_tags(): void
    {
        $this->requireFfmpeg();
        $file = $this->audio('hires.flac', ['-c:a', 'flac', '-sample_fmt', 's32', '-bits_per_raw_sample', '24',
            '-metadata', 'album=Глибина', '-metadata', 'date=2024-03-01', '-metadata', 'track=3/10', '-metadata', 'genre=Ambient'], 96000);

        $track = $this->upload(User::factory()->create(), $file, ['genre' => 'Electronic']);

        $this->assertSame('flac', $track->codec);
        $this->assertSame(96000, $track->sample_rate);
        $this->assertSame(24, $track->bit_depth);
        $this->assertSame(1, $track->channels);
        $this->assertSame(Track::QUALITY_HIRES, $track->quality);
        $this->assertSame(1, $track->duration);
        // Порожні поля — з тегів, введене користувачем (жанр, назва) — не чіпаємо.
        $this->assertSame('Глибина', $track->album);
        $this->assertSame(2024, $track->year);
        $this->assertSame(3, $track->track_no);
        $this->assertSame('Electronic', $track->genre);
        $this->assertSame('Сигнал', $track->title);
        $this->assertNull($track->stream_path);
        $this->assertFalse($track->processing);
    }

    public function test_cd_quality_wav_is_lossless_and_plays_as_is(): void
    {
        $this->requireFfmpeg();
        $track = $this->upload(User::factory()->create(), $this->audio('cd.wav', ['-c:a', 'pcm_s16le', '-ac', '2']));

        $this->assertSame('pcm_s16le', $track->codec);
        $this->assertSame(44100, $track->sample_rate);
        $this->assertSame(16, $track->bit_depth);
        $this->assertSame(2, $track->channels);
        $this->assertSame(Track::QUALITY_LOSSLESS, $track->quality);
        $this->assertNull($track->stream_path);
        $this->assertSame(Storage::disk('public')->url($track->path), $track->url);
    }

    public function test_mp3_is_lossy_and_embedded_cover_is_saved(): void
    {
        $this->requireFfmpeg();
        $file = $this->audio('song.mp3', ['-c:a', 'libmp3lame', '-b:a', '192k', '-id3v2_version', '3', '-metadata', 'album=Обкладинка'], cover: true);

        $track = $this->upload(User::factory()->create(), $file);

        $this->assertSame('mp3', $track->codec);
        $this->assertSame(Track::QUALITY_LOSSY, $track->quality);
        $this->assertNull($track->bit_depth);
        $this->assertGreaterThan(100, $track->bitrate);
        $this->assertSame('Обкладинка', $track->album);
        $this->assertNotNull($track->cover_path);
        Storage::disk('public')->assertExists($track->cover_path);
    }

    public function test_user_cover_is_not_replaced_by_embedded_one(): void
    {
        $this->requireFfmpeg();
        $file = $this->audio('covered.mp3', ['-c:a', 'libmp3lame', '-id3v2_version', '3'], cover: true);

        $track = $this->upload(User::factory()->create(), $file, ['cover' => UploadedFile::fake()->image('mine.jpg', 300, 300)]);
        $mine = $track->cover_path;

        $this->assertNotNull($mine);
        $this->assertCount(1, Storage::disk('public')->files(dirname($mine)));
    }

    public function test_aiff_gets_aac_copy_for_browser_and_keeps_original(): void
    {
        $this->requireFfmpeg();
        $user = User::factory()->create();
        $track = $this->upload($user, $this->audio('studio.aiff', ['-c:a', 'pcm_s24be'], 48000));

        $this->assertSame(Track::QUALITY_LOSSLESS, $track->quality);
        $this->assertSame(24, $track->bit_depth);
        $this->assertFalse($track->processing);
        $this->assertNotNull($track->stream_path);
        $this->assertStringEndsWith('.m4a', $track->stream_path);
        Storage::disk('public')->assertExists([$track->path, $track->stream_path]);
        $this->assertStringEndsWith('.aiff', $track->path);
        $this->assertSame(Storage::disk('public')->url($track->stream_path), $track->url);
        $this->assertSame('aac', app(AudioProbe::class)->probe(Storage::disk('public')->path($track->stream_path))['codec']);
        $this->assertTrue(Track::query()->ready()->whereKey($track->id)->exists());

        // «Завантажити» віддає оригінал без втрат.
        $this->actingAs($user)->get(route('tracks.download', $track))->assertOk()
            ->assertDownload('Test - Signal.aiff');
    }

    public function test_alac_in_m4a_gets_aac_copy(): void
    {
        $this->requireFfmpeg();
        $track = $this->upload(User::factory()->create(), $this->audio('apple.m4a', ['-c:a', 'alac']));

        $this->assertSame('alac', $track->codec);
        $this->assertSame(Track::QUALITY_LOSSLESS, $track->quality);
        $this->assertNotNull($track->stream_path);
        Storage::disk('public')->assertExists($track->stream_path);
    }

    public function test_extra_formats_need_real_audio_and_ffmpeg(): void
    {
        $this->requireFfmpeg();
        $user = User::factory()->create();
        file_put_contents($this->dir.'/fake.ape', random_bytes(4096));

        $this->actingAs($user)->postJson(route('tracks.store'), [
            'audio' => new UploadedFile($this->dir.'/fake.ape', 'fake.ape', null, null, true),
            'title' => 'Шум',
            'artist' => 'Тест',
        ])->assertJsonValidationErrors('audio');

        $this->assertContains('ape', Track::uploadFormats());
        $this->assertSame(0, Track::query()->count());
    }

    public function test_upload_works_without_ffmpeg(): void
    {
        config(['services.ffmpeg.ffprobe' => '/nonexistent/ffprobe', 'services.ffmpeg.ffmpeg' => '/nonexistent/ffmpeg']);
        app()->forgetInstance(AudioProbe::class);
        $user = User::factory()->create();

        $this->assertSame(Track::AUDIO_MIMES, Track::uploadFormats());

        $this->actingAs($user)->post(route('tracks.store'), [
            'audio' => UploadedFile::fake()->create('song.mp3', 200, 'audio/mpeg'),
            'title' => 'Без ffmpeg',
            'artist' => 'Тест',
        ])->assertCreated();
        $track = Track::query()->sole();
        $this->assertNull($track->codec);
        $this->assertFalse($track->processing);

        $this->actingAs($user)->postJson(route('tracks.store'), [
            'audio' => UploadedFile::fake()->create('studio.aiff', 200, 'application/octet-stream'),
            'title' => 'AIFF',
            'artist' => 'Тест',
        ])->assertJsonValidationErrors('audio');
    }
}
