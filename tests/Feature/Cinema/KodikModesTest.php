<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\Kodik\KodikCatalogSynchronizer;
use App\Cinema\RebindKodikTitleJob;
use App\Cinema\Title;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class KodikModesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'mode-token');
        Queue::fake();
        Http::fake(['kodik-api.com/list*' => Http::response(['results' => []])]);
    }

    public function test_missing_mode_queues_only_titles_without_a_working_player_including_legacy_links(): void
    {
        $missing = Title::create(['type' => 'movie', 'category' => 'movie', 'name' => 'Missing']);
        Title::create(['type' => 'movie', 'category' => 'movie', 'name' => 'Working',
            'kodik_link' => 'https://kodik.info/video/working']);
        $run = app(KodikCatalogSynchronizer::class)->run('missing', 100);
        $this->assertSame(1, $run->counters['queued']);
        Queue::assertPushed(RebindKodikTitleJob::class, 1);
        Queue::assertPushed(fn (RebindKodikTitleJob $job) => $job->titleId === $missing->id && $job->onlyMissing);
        Http::assertNothingSent();
    }

    public function test_full_mode_rebinds_existing_titles_instead_of_importing_the_provider_catalog(): void
    {
        Title::create(['type' => 'movie', 'category' => 'movie', 'name' => 'Existing',
            'kodik_link' => 'https://kodik.info/video/existing']);
        $run = app(KodikCatalogSynchronizer::class)->run('full', 100);
        $this->assertSame(1, $run->counters['queued']);
        Queue::assertPushed(fn (RebindKodikTitleJob $job) => ! $job->onlyMissing);
        Http::assertNothingSent();
    }

    public function test_reconcile_mode_selects_failed_stale_and_series_titles(): void
    {
        Title::create(['type' => 'movie', 'category' => 'movie', 'name' => 'Fresh', 'kodik_checked_at' => now()]);
        $failed = Title::create(['type' => 'movie', 'category' => 'movie', 'name' => 'Failed',
            'kodik_checked_at' => now(), 'kodik_sync_status' => 'failed']);
        $stale = Title::create(['type' => 'movie', 'category' => 'movie', 'name' => 'Stale',
            'kodik_checked_at' => now()->subDays(2)]);
        $series = Title::create(['type' => 'series', 'category' => 'series', 'name' => 'Series', 'kodik_checked_at' => now()]);
        $run = app(KodikCatalogSynchronizer::class)->run('reconcile', 100);
        $this->assertSame(3, $run->counters['queued']);
        Queue::assertPushed(RebindKodikTitleJob::class, 3);
        foreach ([$failed, $stale, $series] as $title) {
            Queue::assertPushed(fn (RebindKodikTitleJob $job) => $job->titleId === $title->id);
        }
        Http::assertNothingSent();
    }

    public function test_cli_rejects_a_page_above_the_kodik_api_limit(): void
    {
        $this->artisan('cinema:kodik-sync', ['--batch' => 101])->assertFailed();
        Http::assertNothingSent();
    }
}

