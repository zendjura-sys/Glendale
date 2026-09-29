<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncRun;
use App\Cinema\Kodik\KodikItemSynchronizer;
use App\Cinema\RebindKodikTitleJob;
use App\Cinema\Title;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RebindKodikTitleJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_duplicate_delivery_counts_a_title_once_and_preserves_binding_on_empty_search(): void
    {
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-token');
        Http::fake(['kodik-api.com/search*' => Http::response(['total' => 0, 'results' => []])]);
        $title = Title::create([
            'tmdb_id' => 12345, 'type' => 'movie', 'name' => 'Залишити старий плеєр',
            'kodik_link' => 'https://kodik.info/old',
        ]);
        $run = CinemaSyncRun::create([
            'source' => 'kodik', 'mode' => 'rebind_all', 'status' => 'queued',
            'initiator' => 'admin', 'counters' => ['queued' => 1, 'completed' => 0],
            'started_at' => now(),
        ]);

        $job = new RebindKodikTitleJob($run->id, $title->id, false);
        $job->handle(app(KodikItemSynchronizer::class));
        $job->handle(app(KodikItemSynchronizer::class));

        $this->assertSame('https://kodik.info/old', $title->fresh()->kodik_link);
        $this->assertSame(1, $run->fresh()->counters['completed']);
        $this->assertSame(1, $run->fresh()->counters['not_found']);
        $this->assertSame('succeeded', $run->fresh()->status);
    }
}
