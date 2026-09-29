<?php

namespace Tests\Feature\Cinema;

use App\Cinema\AttachPlayerJob;
use App\Cinema\CinemaSettings;
use App\Cinema\Kodik;
use App\Cinema\Kodik\KodikApiException;
use App\Cinema\Title;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class KodikAttachTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'secret-kodik-token');
        Http::preventStrayRequests();
    }

    public function test_valid_result_attaches_iframe_and_marks_successful_check(): void
    {
        Http::fake(['kodikapi.com/search*' => Http::response(['results' => [[
            'type' => 'foreign-movie',
            'link' => '//kodik.info/video/42/player/720p',
            'translation' => ['id' => 7, 'title' => 'Українська'],
            'quality' => 'WEB-DL 1080p',
        ]]])]);
        $title = Title::create(['tmdb_id' => 1001, 'imdb_id' => 'tt1001', 'type' => 'movie', 'name' => 'Тест']);

        $result = Kodik::attachResult($title);

        $title->refresh();
        $this->assertSame('attached', $result->status);
        $this->assertSame('https://kodik.info/video/42/player/720p', $title->kodik_link);
        $this->assertNotNull($title->kodik_checked_at);
        $this->assertSame('attached', $title->kodik_sync_status);
        $this->assertNull($title->kodik_last_error);
    }

    public function test_valid_empty_result_marks_not_found_and_successful_check(): void
    {
        Http::fake(['kodikapi.com/search*' => Http::response(['results' => []])]);
        $title = Title::create(['tmdb_id' => 1002, 'imdb_id' => 'tt1002', 'type' => 'movie', 'name' => 'Порожньо']);

        $result = Kodik::attachResult($title);

        $title->refresh();
        $this->assertSame('not_found', $result->status);
        $this->assertNull($title->kodik_link);
        $this->assertNotNull($title->kodik_checked_at);
        $this->assertSame('not_found', $title->kodik_sync_status);
        $this->assertNull($title->kodik_last_error);
    }

    public function test_technical_failure_keeps_checked_at_unchanged_and_records_safe_reason(): void
    {
        Http::fake(['kodikapi.com/search*' => Http::response(['error' => 'upstream'], 503)]);
        $checkedAt = now()->subDay();
        $title = Title::create([
            'tmdb_id' => 1003,
            'imdb_id' => 'tt1003',
            'type' => 'movie',
            'name' => 'Помилка',
            'kodik_checked_at' => $checkedAt,
        ]);

        $result = Kodik::attachResult($title);

        $title->refresh();
        $this->assertSame('failed', $result->status);
        $this->assertTrue($result->retryable());
        $this->assertSame($checkedAt->timestamp, $title->kodik_checked_at?->timestamp);
        $this->assertSame('failed', $title->kodik_sync_status);
        $this->assertSame('server', $title->kodik_last_error);
        $this->assertStringNotContainsString('secret-kodik-token', (string) $title->kodik_last_error);
    }

    public function test_queue_rethrows_retryable_failure_after_recording_it(): void
    {
        Http::fake(['kodikapi.com/search*' => Http::response([], 429)]);
        $title = Title::create(['tmdb_id' => 1004, 'imdb_id' => 'tt1004', 'type' => 'movie', 'name' => 'Ліміт']);

        try {
            (new AttachPlayerJob('kodik', $title->id))->handle();
            $this->fail('Retryable Kodik failure must be returned to the queue.');
        } catch (KodikApiException $exception) {
            $this->assertSame('rate_limit', $exception->kind());
        }

        $title->refresh();
        $this->assertNull($title->kodik_checked_at);
        $this->assertSame('failed', $title->kodik_sync_status);
        $this->assertSame('rate_limit', $title->kodik_last_error);
    }

    public function test_queue_does_not_retry_terminal_auth_failure(): void
    {
        Http::fake(['kodikapi.com/search*' => Http::response([], 401)]);
        $title = Title::create(['tmdb_id' => 1005, 'imdb_id' => 'tt1005', 'type' => 'movie', 'name' => 'Токен']);

        (new AttachPlayerJob('kodik', $title->id))->handle();

        $title->refresh();
        $this->assertNull($title->kodik_checked_at);
        $this->assertSame('failed', $title->kodik_sync_status);
        $this->assertSame('auth', $title->kodik_last_error);
    }

    public function test_search_tries_every_supported_identity_and_localized_name(): void
    {
        Http::fake(['kodikapi.com/search*' => Http::response(['results' => []])]);
        $title = Title::create([
            'tmdb_id' => 1006,
            'shikimori_id' => 11,
            'imdb_id' => 'tt1006',
            'mdl_id' => 22,
            'worldart_link' => 'https://www.world-art.ru/animation/animation.php?id=33',
            'type' => 'series',
            'name' => 'Українська назва',
            'original_name' => 'English Title',
            'alt_names' => ['Русское название'],
            'year' => 2026,
        ]);

        Kodik::search($title);

        foreach ([
            'shikimori_id=11',
            'imdb_id=tt1006',
            'mdl_id=22',
            'worldart_link=',
            'title=English%20Title',
            'title=%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D1%81%D1%8C%D0%BA%D0%B0%20%D0%BD%D0%B0%D0%B7%D0%B2%D0%B0',
            'title=%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%BE%D0%B5%20%D0%BD%D0%B0%D0%B7%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5',
        ] as $needle) {
            Http::assertSent(fn ($request) => str_contains((string) $request->url(), $needle));
        }
    }
}
