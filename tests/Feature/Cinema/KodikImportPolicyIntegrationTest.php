<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncRun;
use App\Cinema\Kodik\KodikItemSynchronizer;
use App\Cinema\Title;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KodikImportPolicyIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_rejected_update_does_not_hide_or_change_existing_published_title(): void
    {
        CinemaSettings::setKodikImportPolicy(['blocked_genres' => ['драма']]);
        $title = Title::create([
            'tmdb_id' => 7001,
            'type' => 'movie',
            'name' => 'Опублікований',
            'imdb_id' => 'tt7001',
            'kodik_link' => 'https://kodik.info/video/old/720p',
            'is_published' => true,
        ]);

        $result = app(KodikItemSynchronizer::class)->sync($this->item([
            'id' => 'movie-7001',
            'imdb_id' => 'tt7001',
            'material_data' => ['genres' => ['драма']],
        ]), $this->syncRun());

        $title->refresh();
        $this->assertSame('rejected', $result->status);
        $this->assertSame('genre_blocked', $result->event->message);
        $this->assertTrue($title->is_published);
        $this->assertSame('https://kodik.info/video/old/720p', $title->kodik_link);
    }

    public function test_auto_publish_setting_controls_only_new_valid_titles(): void
    {
        CinemaSettings::setKodikImportPolicy(['auto_publish' => false]);

        $result = app(KodikItemSynchronizer::class)->sync($this->item(), $this->syncRun());

        $this->assertSame('created', $result->status);
        $this->assertFalse($result->title?->fresh()->is_published);
        $this->assertNotNull($result->title?->fresh()->kodik_link);
    }

    public function test_update_existing_setting_prevents_replacement_but_keeps_new_imports_enabled(): void
    {
        CinemaSettings::setKodikImportPolicy(['update_existing' => false]);
        $existing = Title::create([
            'tmdb_id' => 7002,
            'type' => 'movie',
            'name' => 'Ручна назва',
            'imdb_id' => 'tt7002',
            'is_published' => true,
        ]);

        $blocked = app(KodikItemSynchronizer::class)->sync($this->item([
            'id' => 'movie-7002',
            'imdb_id' => 'tt7002',
        ]), $this->syncRun());
        $created = app(KodikItemSynchronizer::class)->sync($this->item([
            'id' => 'movie-7003',
            'imdb_id' => 'tt7003',
        ]), $this->syncRun());

        $this->assertSame('rejected', $blocked->status);
        $this->assertSame('updates_disabled', $blocked->event->message);
        $this->assertNull($existing->fresh()->kodik_link);
        $this->assertSame('created', $created->status);
    }

    private function syncRun(): CinemaSyncRun
    {
        return CinemaSyncRun::create([
            'source' => 'kodik',
            'mode' => 'incremental',
            'status' => 'running',
            'initiator' => 'test',
            'started_at' => now(),
        ]);
    }

    /** @param array<string, mixed> $changes @return array<string, mixed> */
    private function item(array $changes = []): array
    {
        return array_replace_recursive([
            'id' => 'movie-7000',
            'type' => 'foreign-movie',
            'title' => 'Новий тайтл',
            'year' => 2026,
            'link' => 'https://kodik.info/video/7000/720p',
            'translation' => ['id' => 9, 'title' => 'Українська', 'type' => 'voice'],
            'material_data' => ['genres' => ['пригоди']],
        ], $changes);
    }
}
