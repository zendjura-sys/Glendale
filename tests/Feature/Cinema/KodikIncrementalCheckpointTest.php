<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\Kodik\KodikCatalogSynchronizer;
use App\Cinema\Kodik\KodikItemSynchronizer;
use App\Cinema\SyncKodikItemJob;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

class KodikIncrementalCheckpointTest extends TestCase
{
    use RefreshDatabase;

    private function item(string $id, string $updated): array
    {
        return ['id' => $id, 'title' => $id, 'type' => 'foreign-movie',
            'link' => 'https://kodik.info/video/'.$id, 'updated_at' => $updated];
    }

    public function test_watermark_advances_only_after_successful_workers_and_stops_at_older_page(): void
    {
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-token');
        Queue::fake();
        $first = $this->item('first', '2026-09-30T05:00:00Z');
        Http::fake(['kodik-api.com/list*' => Http::response(['results' => [$first]])]);
        $run = app(KodikCatalogSynchronizer::class)->run('incremental', 100);
        $this->assertNull(Setting::get('cinema_kodik_watermark'));
        (new SyncKodikItemJob($run->id, $first))->handle(app(KodikItemSynchronizer::class));
        $this->assertNotNull(Setting::get('cinema_kodik_watermark'));

        $new = $this->item('new', '2026-09-30T06:00:00Z');
        $old = $this->item('old', '2026-09-29T05:00:00Z');
        Http::fake(['kodik-api.com/list*' => Http::response([
            'results' => [$new, $old], 'next_page' => 'https://kodik-api.com/list?page=2',
        ])]);
        $second = app(KodikCatalogSynchronizer::class)->run('incremental', 100);
        $this->assertSame(1, $second->counters['queued']);
        $this->assertNull($second->cursor_after);
        Http::assertSent(fn ($request) => ($request->data()['sort'] ?? null) === 'updated_at'
            && ($request->data()['order'] ?? null) === 'desc');
    }

    public function test_dispatch_creation_uses_an_atomic_lock(): void
    {
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-token');
        Http::fake(['kodik-api.com/list*' => Http::response(['results' => []])]);
        $lock = Cache::lock('cinema:kodik:dispatch:incremental', 60);
        $this->assertTrue($lock->get());
        try {
            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage('already running');
            app(KodikCatalogSynchronizer::class)->run('incremental', 100);
        } finally {
            $lock->release();
        }
    }
}

