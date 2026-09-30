<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncRun;
use App\Cinema\Episode;
use App\Cinema\Kodik\KodikCatalogSynchronizer;
use App\Cinema\Kodik\KodikItemSynchronizer;
use App\Cinema\Season;
use App\Cinema\Title;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class KodikEpisodeImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_requests_episode_details(): void
    {
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-token');
        Queue::fake();
        Http::fake(['kodik-api.com/list*' => Http::response(['results' => []])]);
        app(KodikCatalogSynchronizer::class)->run('incremental', 100);
        Http::assertSent(fn ($request) => $request['with_episodes_data'] === 'true');
    }

    public function test_import_populates_episode_picker_and_preserves_manual_metadata(): void
    {
        $title = Title::create(['type' => 'series', 'category' => 'series', 'name' => 'Manual title', 'kodik_id' => 'serial-one']);
        $season = Season::create(['title_id' => $title->id, 'number' => 4, 'name' => 'Manual season', 'episodes_count' => 1]);
        $episode = Episode::create(['title_id' => $title->id, 'season_id' => $season->id,
            'number' => 25, 'name' => 'Manual episode', 'overview' => 'Keep this', 'still_path' => 'manual.jpg']);
        $run = CinemaSyncRun::create(['source' => 'kodik', 'mode' => 'incremental', 'status' => 'running']);
        $item = ['id' => 'serial-one', 'type' => 'foreign-serial', 'title' => 'Provider title',
            'link' => 'https://kodik.info/serial/one', 'translation' => ['id' => 1],
            'seasons' => ['4' => ['episodes' => [
                '25' => ['link' => 'https://kodik.info/serial/25', 'title' => 'Provider 25'],
                '26' => ['link' => 'https://kodik.info/serial/26', 'title' => 'Provider 26',
                    'screenshots' => ['https://images.example/26.jpg']],
            ]], '5' => ['episodes' => ['1' => 'https://kodik.info/serial/51']]]];

        app(KodikItemSynchronizer::class)->sync($item, $run);
        app(KodikItemSynchronizer::class)->sync($item, $run);
        $this->assertSame([4, 5], $title->seasons()->pluck('number')->all());
        $this->assertSame([25, 26], $season->episodes()->pluck('number')->all());
        $this->assertSame('Manual episode', $episode->fresh()->name);
        $this->assertSame('Keep this', $episode->fresh()->overview);
        $this->assertSame('manual.jpg', $episode->fresh()->still_path);
        $this->assertSame('Manual season', $season->fresh()->name);
        $this->assertSame(26, $season->fresh()->episodes_count);
        $this->assertSame('Provider 26', $season->episodes()->where('number', 26)->firstOrFail()->name);
        $this->assertSame(2, $title->fresh()->seasons_count);
        $this->assertSame(3, $title->fresh()->episodes_count);
    }
}

