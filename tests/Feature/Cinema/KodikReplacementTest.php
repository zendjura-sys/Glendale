<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncRun;
use App\Cinema\Kodik\KodikItemSynchronizer;
use App\Cinema\KodikSource;
use App\Cinema\RebindKodikTitleJob;
use App\Cinema\Title;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class KodikReplacementTest extends TestCase
{
    use RefreshDatabase;

    public function test_full_rebind_retires_old_translations_after_successful_replacement(): void
    {
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-token');
        $title = Title::create(['type' => 'movie', 'name' => 'Film', 'kodik_id' => 'movie-film',
            'kodik_link' => 'https://kodik.info/video/old']);
        $old = KodikSource::create(['title_id' => $title->id, 'kodik_id' => 'movie-film',
            'translation_id' => '1', 'link' => 'https://kodik.info/video/old', 'is_available' => true]);
        $run = CinemaSyncRun::create(['source' => 'kodik', 'mode' => 'full', 'status' => 'queued',
            'counters' => ['queued' => 1, 'completed' => 0]]);
        Http::fake(['kodik-api.com/search*' => Http::response(['results' => [
            ['id' => 'movie-film', 'type' => 'foreign-movie', 'title' => 'Film',
                'link' => 'https://kodik.info/video/new', 'translation' => ['id' => 2]],
        ]])]);
        (new RebindKodikTitleJob($run->id, $title->id, false))->handle(app(KodikItemSynchronizer::class));
        $this->assertFalse($old->fresh()->is_available);
        $this->assertSame('https://kodik.info/video/new', $title->fresh()->kodik_link);
        $this->assertCount(1, $title->fresh()->kodik_translations);
    }

    public function test_missing_worker_preserves_a_legacy_link_without_contacting_provider(): void
    {
        $title = Title::create(['type' => 'movie', 'name' => 'Legacy',
            'kodik_link' => 'https://kodik.info/video/legacy']);
        $run = CinemaSyncRun::create(['source' => 'kodik', 'mode' => 'missing', 'status' => 'queued',
            'counters' => ['queued' => 1, 'completed' => 0]]);
        Http::fake();
        (new RebindKodikTitleJob($run->id, $title->id, true))->handle(app(KodikItemSynchronizer::class));
        Http::assertNothingSent();
        $this->assertSame('https://kodik.info/video/legacy', $title->fresh()->kodik_link);
        $this->assertSame(1, $run->fresh()->counters['skipped']);
    }
}

