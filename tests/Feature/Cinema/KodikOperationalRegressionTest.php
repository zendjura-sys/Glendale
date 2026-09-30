<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncRun;
use App\Cinema\Kodik\KodikCatalogSynchronizer;
use App\Cinema\Kodik\KodikItemSynchronizer;
use App\Cinema\RebindKodikTitleJob;
use App\Cinema\SyncKodikItemJob;
use App\Cinema\Title;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class KodikOperationalRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_initial_catalog_is_processed_in_bounded_resumable_segments(): void
    {
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-token');
        Queue::fake();
        Http::fake(['kodik-api.com/list*' => function ($request) {
            $page = (int) ($request->data()['page'] ?? 1);
            return Http::response(['results' => [[
                'id' => 'movie-'.$page, 'title' => 'Film '.$page, 'type' => 'foreign-movie',
                'link' => 'https://kodik.info/video/'.$page,
                'updated_at' => $page === 1 ? '2026-09-30T06:00:00Z' : '2026-09-29T06:00:00Z',
            ]], 'next_page' => $page < 11 ? 'https://kodik-api.com/list?page='.($page + 1) : null]);
        }]);
        $run = app(KodikCatalogSynchronizer::class)->run('incremental', 1);
        $this->assertSame(10, $run->counters['pages']);
        $this->assertSame('https://kodik-api.com/list?page=11', $run->cursor_after);
        for ($page = 1; $page <= 10; $page++) {
            (new SyncKodikItemJob($run->id, [
                'id' => 'movie-'.$page, 'title' => 'Film '.$page, 'type' => 'foreign-movie',
                'link' => 'https://kodik.info/video/'.$page,
            ]))->handle(app(KodikItemSynchronizer::class));
        }
        $this->assertNull(Setting::get('cinema_kodik_watermark'));
        $this->assertSame('succeeded', $run->fresh()->status);
        $next = app(KodikCatalogSynchronizer::class)->run('incremental', 1, CinemaSettings::kodikCursor());
        (new SyncKodikItemJob($next->id, [
            'id' => 'movie-11', 'title' => 'Film 11', 'type' => 'foreign-movie', 'link' => 'https://kodik.info/video/11',
        ]))->handle(app(KodikItemSynchronizer::class));
        $this->assertNull(CinemaSettings::kodikCursor());
        $this->assertSame('2026-09-30T06:00:00+00:00', Setting::get('cinema_kodik_watermark'));
    }

    public function test_rebind_does_not_create_an_unrelated_title_from_fuzzy_search(): void
    {
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-token');
        $title = Title::create(['type' => 'movie', 'name' => 'Wanted title', 'kodik_link' => 'https://kodik.info/video/old']);
        $run = CinemaSyncRun::create(['source' => 'kodik', 'mode' => 'full', 'status' => 'queued', 'counters' => ['queued' => 1, 'completed' => 0]]);
        Http::fake(['kodik-api.com/search*' => Http::response(['results' => [[
            'id' => 'movie-unrelated', 'type' => 'foreign-movie', 'title' => 'Unrelated title',
            'link' => 'https://kodik.info/video/unrelated',
        ]]])]);
        (new RebindKodikTitleJob($run->id, $title->id, false))->handle(app(KodikItemSynchronizer::class));
        $this->assertSame(1, Title::count());
        $this->assertSame('https://kodik.info/video/old', $title->fresh()->kodik_link);
    }
}

