<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncRun;
use App\Cinema\SyncKodikItemJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class SyncKodikCinemaCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'command-token');
        Http::preventStrayRequests();
        Queue::fake();
    }

    public function test_rejects_unknown_mode_and_invalid_batch(): void
    {
        $this->artisan('cinema:kodik-sync', ['--mode' => 'wrong'])->assertFailed();
        $this->artisan('cinema:kodik-sync', ['--batch' => 0])->assertFailed();
        $this->artisan('cinema:kodik-sync', ['--batch' => 501])->assertFailed();
        Http::assertNothingSent();
    }

    public function test_full_mode_requires_explicit_confirmation_flag(): void
    {
        $this->artisan('cinema:kodik-sync', ['--mode' => 'full'])->assertFailed();
        $this->assertSame(0, CinemaSyncRun::count());
    }

    public function test_dry_run_reads_preview_without_database_or_queue_writes(): void
    {
        Http::fake(['kodikapi.com/list*' => Http::response(['results' => [['id' => 'preview']], 'next_page' => null])]);

        $this->artisan('cinema:kodik-sync', ['--mode' => 'incremental', '--batch' => 25, '--dry-run' => true])
            ->assertSuccessful()
            ->expectsOutputToContain('1');

        $this->assertSame(0, CinemaSyncRun::count());
        Queue::assertNothingPushed();
    }
}
