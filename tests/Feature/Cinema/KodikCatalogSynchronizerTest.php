<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncRun;
use App\Cinema\Kodik\KodikApiException;
use App\Cinema\Kodik\KodikCatalogSynchronizer;
use App\Cinema\SyncKodikItemJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

class KodikCatalogSynchronizerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'catalog-token');
        Http::preventStrayRequests();
        Queue::fake();
    }

    public function test_two_pages_are_queued_and_cursor_commits_after_each_page(): void
    {
        Http::fakeSequence('kodik-api.com/list*')
            ->push(['results' => [['id' => 'a'], ['id' => 'b']], 'next_page' => 'https://kodik-api.com/list?page=2', 'total' => 3])
            ->push(['results' => [['id' => 'c']], 'next_page' => null, 'total' => 3]);

        $run = app(KodikCatalogSynchronizer::class)->run('incremental', 2, null, 'cli');

        $this->assertSame('running', $run->status);
        $this->assertSame(3, $run->counters['seen']);
        $this->assertSame(2, $run->counters['pages']);
        $this->assertNull($run->cursor_after);
        $this->assertNull(CinemaSettings::kodikCursor());
        Queue::assertPushed(SyncKodikItemJob::class, 3);
        Queue::assertPushed(fn (SyncKodikItemJob $job) => $job->runId === $run->id && $job->item['id'] === 'c');
        Http::assertSent(fn ($request) => str_contains((string) $request->url(), 'page=2'));
    }

    public function test_failed_second_page_keeps_its_cursor_and_resume_does_not_skip_it(): void
    {
        $secondPageWorks = false;
        Http::fake(['kodik-api.com/list*' => function ($request) use (&$secondPageWorks) {
            parse_str((string) parse_url((string) $request->url(), PHP_URL_QUERY), $query);
            if (($query['page'] ?? null) === '2') {
                return $secondPageWorks
                    ? Http::response(['results' => [['id' => 'second']], 'next_page' => null])
                    : Http::response(['error' => 'temporary'], 503);
            }

            return Http::response(['results' => [['id' => 'first']], 'next_page' => 'https://kodik-api.com/list?page=2']);
        }]);

        try {
            app(KodikCatalogSynchronizer::class)->run('incremental', 100, null, 'scheduler');
            $this->fail('Second page failure must propagate.');
        } catch (KodikApiException $exception) {
            $this->assertSame('server', $exception->kind());
        }

        $failed = CinemaSyncRun::query()->latest('id')->firstOrFail();
        $this->assertSame('partial', $failed->status);
        $this->assertSame('https://kodik-api.com/list?page=2', $failed->cursor_after);
        $this->assertSame('https://kodik-api.com/list?page=2', CinemaSettings::kodikCursor());
        Queue::assertPushed(fn (SyncKodikItemJob $job) => $job->item['id'] === 'first');

        $secondPageWorks = true;
        $resumed = app(KodikCatalogSynchronizer::class)->run('incremental', 100, CinemaSettings::kodikCursor(), 'scheduler');
        $this->assertSame('running', $resumed->status);
        Queue::assertPushed(fn (SyncKodikItemJob $job) => $job->runId === $resumed->id && $job->item['id'] === 'second');
    }

    public function test_parallel_run_of_same_mode_is_refused(): void
    {
        CinemaSyncRun::create([
            'source' => 'kodik', 'mode' => 'incremental', 'status' => 'running',
            'initiator' => 'scheduler', 'started_at' => now(),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('already running');
        app(KodikCatalogSynchronizer::class)->run('incremental', 100, null, 'scheduler');
    }
}

