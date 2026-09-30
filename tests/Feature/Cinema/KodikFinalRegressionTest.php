<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\Importer;
use App\Cinema\Kodik\KodikClient;
use App\Cinema\KodikSource;
use App\Cinema\Title;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class KodikFinalRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_next_page_url_does_not_escape_the_client(): void
    {
        Http::fake(['kodik-api.com/list*' => Http::response(['results' => [],
            'next_page' => 'https://kodik-api.com/list?token=private-test-token&page=2'])]);
        $page = (new KodikClient('private-test-token'))->list(['limit' => 1]);
        $this->assertStringNotContainsString('private-test-token', json_encode($page));
        $this->assertStringContainsString('page=2', $page->nextPage);
    }

    public function test_selected_season_uses_a_kodik_variant_that_contains_its_episode(): void
    {
        $title = Title::create(['type' => 'series', 'name' => 'Series', 'is_published' => true,
            'kodik_link' => 'https://kodik.info/serial/first']);
        $season = $title->seasons()->create(['number' => 4, 'name' => 'Season 4']);
        $season->episodes()->create(['title_id' => $title->id, 'number' => 25]);
        foreach ([
            ['translation_id' => '1', 'link' => 'https://kodik.info/serial/first',
                'availability' => ['seasons' => ['1' => ['episodes' => ['1' => 'https://kodik.info/serial/one']]]]],
            ['translation_id' => '2', 'link' => 'https://kodik.info/serial/second',
                'availability' => ['seasons' => ['4' => ['episodes' => ['25' => 'https://kodik.info/serial/25']]]]],
        ] as $data) {
            KodikSource::create($data + ['title_id' => $title->id, 'kodik_id' => 'serial-one', 'is_available' => true]);
        }
        Sanctum::actingAs(User::factory()->create());
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=0&season=4&episode=25")
            ->assertOk()->assertJsonPath('link', 'https://kodik.info/serial/second')
            ->assertJsonPath('selection.season', 4)->assertJsonPath('selection.episode', 25);
    }

    public function test_lazy_tmdb_episode_enrichment_preserves_manual_fields(): void
    {
        CinemaSettings::setSecret(CinemaSettings::TMDB_KEY, 'tmdb-test-key');
        $title = Title::create(['tmdb_id' => 900, 'type' => 'series', 'name' => 'Series']);
        $season = $title->seasons()->create(['number' => 4, 'name' => 'Manual season', 'episodes_count' => 25]);
        $episode = $season->episodes()->create(['title_id' => $title->id, 'number' => 25,
            'name' => 'Manual name', 'overview' => 'Manual overview', 'still_path' => 'manual.jpg']);
        Http::fake(['api.themoviedb.org/3/tv/900/season/4*' => Http::response([
            'episodes' => [['episode_number' => 25, 'name' => 'API name', 'overview' => 'API overview', 'still_path' => '/api.jpg']],
        ])]);
        Importer::importSeason($title, $season);
        $this->assertSame('Manual name', $episode->fresh()->name);
        $this->assertSame('Manual overview', $episode->fresh()->overview);
        $this->assertSame('manual.jpg', $episode->fresh()->still_path);
        $this->assertSame(25, $season->fresh()->episodes_count);
    }
}

