<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSyncEvent;
use App\Cinema\CinemaSyncRun;
use App\Cinema\KodikSource;
use App\Cinema\Title;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class KodikSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_schema_and_title_columns_exist(): void
    {
        $this->assertTrue(Schema::hasColumns('cinema_titles', [
            'kodik_id',
            'kinopoisk_id',
            'kodik_synced_at',
            'kodik_sync_status',
            'kodik_last_error',
        ]));
        $this->assertTrue(Schema::hasColumns('cinema_kodik_sources', [
            'title_id', 'kodik_id', 'translation_id', 'link', 'availability', 'material', 'payload_hash', 'is_available',
        ]));
        $this->assertTrue(Schema::hasTable('cinema_sync_runs'));
        $this->assertTrue(Schema::hasTable('cinema_sync_events'));
    }

    public function test_models_cast_json_dates_and_expose_relationships(): void
    {
        $title = Title::create([
            'tmdb_id' => 2001,
            'type' => 'series',
            'name' => 'Серіал',
            'kodik_id' => 'serial-2001',
            'kinopoisk_id' => 'kp-2001',
            'kodik_synced_at' => now(),
        ]);
        $source = KodikSource::create([
            'title_id' => $title->id,
            'kodik_id' => 'serial-2001',
            'content_type' => 'anime-serial',
            'translation_id' => '77',
            'translation_title' => 'Українська',
            'link' => 'https://kodik.info/serial/2001/77/720p',
            'availability' => ['seasons' => [1, 2], 'episodes' => ['2' => 12]],
            'material' => ['year' => 2026, 'genres' => ['Аніме']],
            'source_updated_at' => now(),
            'is_available' => true,
        ]);
        $run = CinemaSyncRun::create([
            'source' => 'kodik',
            'mode' => 'incremental',
            'status' => 'running',
            'initiator' => 'scheduler',
            'counters' => ['seen' => 1, 'created' => 0],
            'started_at' => now(),
        ]);
        $event = CinemaSyncEvent::create([
            'run_id' => $run->id,
            'title_id' => $title->id,
            'action' => 'player_attached',
            'status' => 'succeeded',
            'identifiers' => ['kodik_id' => 'serial-2001'],
            'context' => ['translation_id' => 77],
            'message' => 'Плеєр прив’язано.',
        ]);

        $this->assertSame([1, 2], $source->availability['seasons']);
        $this->assertSame(2026, $source->material['year']);
        $this->assertTrue($source->is_available);
        $this->assertNotNull($source->source_updated_at);
        $this->assertSame(1, $run->counters['seen']);
        $this->assertNotNull($run->started_at);
        $this->assertSame('serial-2001', $event->identifiers['kodik_id']);
        $this->assertSame(77, $event->context['translation_id']);
        $this->assertSame($source->id, $title->kodikSources->first()->id);
        $this->assertSame($event->id, $title->syncEvents->first()->id);
        $this->assertSame($event->id, $run->events->first()->id);
        $this->assertSame($title->id, $source->title->id);
        $this->assertSame($run->id, $event->run->id);
    }

    public function test_source_identity_is_unique_per_translation(): void
    {
        $title = Title::create(['tmdb_id' => 2002, 'type' => 'movie', 'name' => 'Фільм']);
        $attributes = [
            'title_id' => $title->id,
            'kodik_id' => 'movie-2002',
            'translation_id' => '5',
            'link' => 'https://kodik.info/video/2002/5/720p',
        ];
        KodikSource::create($attributes);

        $this->expectException(QueryException::class);
        KodikSource::create($attributes);
    }

    public function test_deleting_title_and_run_cascades_owned_records(): void
    {
        $title = Title::create(['tmdb_id' => 2003, 'type' => 'movie', 'name' => 'Видалення']);
        $source = KodikSource::create([
            'title_id' => $title->id,
            'kodik_id' => 'movie-2003',
            'translation_id' => '1',
            'link' => 'https://kodik.info/video/2003/1/720p',
        ]);
        $run = CinemaSyncRun::create(['source' => 'kodik', 'mode' => 'full', 'status' => 'running', 'initiator' => 'cli']);
        $event = CinemaSyncEvent::create([
            'run_id' => $run->id,
            'title_id' => $title->id,
            'action' => 'updated',
            'status' => 'succeeded',
        ]);

        $title->delete();
        $this->assertNull(KodikSource::find($source->id));
        $this->assertNull(CinemaSyncEvent::find($event->id));

        $otherTitle = Title::create(['tmdb_id' => 2004, 'type' => 'movie', 'name' => 'Інший']);
        $otherEvent = CinemaSyncEvent::create([
            'run_id' => $run->id,
            'title_id' => $otherTitle->id,
            'action' => 'skipped',
            'status' => 'succeeded',
        ]);
        $run->delete();
        $this->assertNull(CinemaSyncEvent::find($otherEvent->id));
    }
}
