<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\Kodik\KodikApiException;
use App\Cinema\Kodik\KodikCatalogSynchronizer;
use App\Cinema\Kodik\KodikClient;
use App\Cinema\Kodik\KodikItemSynchronizer;
use App\Cinema\SyncKodikItemJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class KodikReviewRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_transport_exception_chain_cannot_expose_token(): void
    {
        Http::fake(fn () => throw new ConnectionException('Failed https://kodik-api.com/search?token=private-test-token'));
        try {
            (new KodikClient('private-test-token'))->search(['title' => 'Test']);
            $this->fail('Expected provider failure.');
        } catch (KodikApiException $exception) {
            $this->assertSame('transport', $exception->kind());
            $this->assertStringNotContainsString('private-test-token', (string) $exception);
        }
    }

    public function test_distinct_translations_have_distinct_queue_identity(): void
    {
        $first = new SyncKodikItemJob(1, ['id' => 'serial-1', 'translation' => ['id' => 10]]);
        $second = new SyncKodikItemJob(1, ['id' => 'serial-1', 'translation' => ['id' => 20]]);
        $this->assertNotSame($first->uniqueId(), $second->uniqueId());
    }

    public function test_catalog_run_finishes_after_item_processing_and_duplicate_delivery_counts_once(): void
    {
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-token');
        Queue::fake();
        $item = ['id' => 'movie-one', 'type' => 'foreign-movie', 'title' => 'One',
            'link' => 'https://kodik.info/video/one', 'translation' => ['id' => 1]];
        Http::fake(['kodik-api.com/list*' => Http::response(['results' => [$item], 'next_page' => null])]);

        $run = app(KodikCatalogSynchronizer::class)->run('incremental', 100);
        $this->assertSame('running', $run->status);
        $this->assertNull($run->finished_at);
        $job = new SyncKodikItemJob($run->id, $item);
        $job->handle(app(KodikItemSynchronizer::class));
        $job->handle(app(KodikItemSynchronizer::class));
        $this->assertSame(1, $run->fresh()->counters['completed']);
        $this->assertSame('succeeded', $run->fresh()->status);
        $this->assertNotNull($run->fresh()->finished_at);
    }
}
