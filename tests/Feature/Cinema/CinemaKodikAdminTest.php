<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\CinemaSyncEvent;
use App\Cinema\CinemaSyncRun;
use App\Cinema\KodikSource;
use App\Cinema\RebindKodikTitleJob;
use App\Cinema\RunKodikSyncJob;
use App\Cinema\Title;
use App\Models\User;
use Database\Seeders\SystemPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CinemaKodikAdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_endpoints_require_cinema_permission(): void
    {
        $this->getJson('/admin/cinema/kodik/runs')->assertUnauthorized();
        $this->actingAs(User::factory()->create())
            ->getJson('/admin/cinema/kodik/runs')->assertForbidden();
    }

    public function test_runs_and_filtered_events_are_paginated_and_secrets_are_redacted(): void
    {
        $this->actingAs($this->admin());
        $run = $this->syncRun();
        CinemaSyncEvent::create([
            'run_id' => $run->id,
            'action' => 'updated',
            'status' => 'failed',
            'message' => 'upstream',
            'identifiers' => ['kodik_id' => 'movie-1'],
            'context' => [
                'token' => 'super-secret',
                'url' => 'https://kodik-api.com/list?token=super-secret&page=2',
                'nested' => ['authorization' => 'Bearer private'],
            ],
        ]);
        CinemaSyncEvent::create([
            'run_id' => $run->id,
            'action' => 'created',
            'status' => 'succeeded',
            'message' => 'ok',
        ]);

        $this->getJson('/admin/cinema/kodik/runs?per_page=10')
            ->assertOk()
            ->assertJsonPath('data.0.id', $run->id)
            ->assertJsonPath('data.0.events_count', 2);

        $response = $this->getJson("/admin/cinema/kodik/runs/{$run->id}/events?status=failed&action=updated&per_page=1")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.context.token', '[REDACTED]')
            ->assertJsonPath('data.0.context.url', 'https://kodik-api.com/list')
            ->assertJsonPath('data.0.context.nested.authorization', '[REDACTED]');
        $this->assertStringNotContainsString('super-secret', $response->getContent());
        $this->assertStringNotContainsString('Bearer private', $response->getContent());
    }

    public function test_settings_are_normalized_saved_and_never_return_token(): void
    {
        $this->actingAs($this->admin());
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'private-token');

        $this->getJson('/admin/cinema/kodik/settings')
            ->assertOk()
            ->assertJsonPath('configured', true)
            ->assertJsonMissing(['token' => 'private-token'])
            ->assertJsonPath('policy.allow_camrip', true);

        $this->putJson('/admin/cinema/kodik/settings', [
            'types' => ['anime-serial'],
            'year_from' => 2020,
            'blocked_genres' => ['еротика'],
            'allow_camrip' => false,
            'auto_publish' => false,
        ])->assertOk()
            ->assertJsonPath('policy.types.0', 'anime-serial')
            ->assertJsonPath('policy.allow_camrip', false);

        $saved = CinemaSettings::kodikImportPolicy();
        $this->assertSame(['anime-serial'], $saved['types']);
        $this->assertFalse($saved['allow_camrip']);

        $this->putJson('/admin/cinema/kodik/settings', [
            'year_from' => 1800,
            'types' => ['not-a-kodik-type'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['year_from', 'types.0']);
    }

    public function test_sync_validates_confirmation_and_dispatches_queued_job(): void
    {
        $this->actingAs($this->admin());
        Queue::fake();

        $this->postJson('/admin/cinema/kodik/sync', ['mode' => 'wrong'])->assertUnprocessable();
        $this->postJson('/admin/cinema/kodik/sync', ['mode' => 'full'])->assertUnprocessable()
            ->assertJsonValidationErrors('confirm_full');
        $this->postJson('/admin/cinema/kodik/sync', [
            'mode' => 'incremental',
            'batch' => 75,
            'dry_run' => false,
        ])->assertAccepted();

        Queue::assertPushed(RunKodikSyncJob::class, fn ($job) => $job->mode === 'incremental'
            && $job->batch === 75 && ! $job->dryRun && $job->initiatedBy !== null);
    }

    public function test_preview_returns_a_visible_result_without_database_or_queue_mutations(): void
    {
        $this->actingAs($this->admin());
        Queue::fake();
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'private-test-token');
        Http::fake(['kodik-api.com/list*' => Http::response(['results' => [['id' => 'preview']], 'total' => 100])]);
        $this->postJson('/admin/cinema/kodik/sync', ['mode' => 'incremental', 'batch' => 1, 'dry_run' => true])
            ->assertOk()->assertJsonPath('preview.count', 1)->assertJsonPath('preview.total', 100);
        $this->assertSame(0, CinemaSyncRun::count());
        $this->assertSame(0, CinemaSyncEvent::count());
        Queue::assertNothingPushed();
    }

    public function test_preview_reports_safe_provider_failure_to_the_administrator(): void
    {
        $this->actingAs($this->admin());
        Queue::fake();
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'private-test-token');
        Http::fake(['kodik-api.com/list*' => Http::response([], 401)]);
        $response = $this->postJson('/admin/cinema/kodik/sync', ['mode' => 'incremental', 'dry_run' => true])
            ->assertStatus(502)->assertJsonPath('error_kind', 'auth')->assertJsonPath('retryable', false);
        $this->assertStringNotContainsString('private-test-token', $response->getContent());
        Queue::assertNothingPushed();
    }

    public function test_full_rebind_requires_confirmation_and_queues_entire_catalog_without_500_limit(): void
    {
        $this->actingAs($this->admin());
        Queue::fake();
        foreach (array_chunk(range(1, 1001), 200) as $chunk) {
            Title::query()->insert(array_map(fn (int $id) => [
                'tmdb_id' => 8000 + $id,
                'type' => 'movie',
                'name' => 'Тайтл '.$id,
                'created_at' => now(),
                'updated_at' => now(),
            ], $chunk));
        }

        $this->postJson('/admin/cinema/kodik/rebind', ['scope' => 'all'])
            ->assertUnprocessable()->assertJsonValidationErrors('confirm');
        $response = $this->postJson('/admin/cinema/kodik/rebind', [
            'scope' => 'all',
            'confirm' => true,
        ])->assertAccepted()->assertJsonPath('queued', 1001);

        $runId = $response->json('run_id');
        Queue::assertPushed(RebindKodikTitleJob::class, 1001);
        Queue::assertPushed(RebindKodikTitleJob::class, fn ($job) => $job->runId === $runId);
    }

    public function test_missing_rebind_only_queues_titles_without_valid_active_source(): void
    {
        $this->actingAs($this->admin());
        Queue::fake();
        $missing = Title::create(['tmdb_id' => 9101, 'type' => 'movie', 'name' => 'Без Kodik', 'kodik_link' => null]);
        $inactive = Title::create(['tmdb_id' => 9102, 'type' => 'movie', 'name' => 'Неактивний', 'kodik_link' => 'https://old.example']);
        $active = Title::create(['tmdb_id' => 9103, 'type' => 'movie', 'name' => 'Активний', 'kodik_link' => 'https://kodik.info/video/active']);
        KodikSource::create([
            'title_id' => $inactive->id, 'kodik_id' => 'inactive', 'translation_id' => '1',
            'link' => 'https://kodik.info/video/inactive', 'is_available' => false,
        ]);
        KodikSource::create([
            'title_id' => $active->id, 'kodik_id' => 'active', 'translation_id' => '1',
            'link' => 'https://kodik.info/video/active', 'is_available' => true,
        ]);

        $this->postJson('/admin/cinema/kodik/rebind', [
            'scope' => 'missing',
            'confirm' => true,
        ])->assertAccepted()->assertJsonPath('queued', 2);

        Queue::assertPushed(RebindKodikTitleJob::class, 2);
        Queue::assertNotPushed(fn (RebindKodikTitleJob $job) => $job->titleId === $active->id);
        Queue::assertPushed(RebindKodikTitleJob::class, fn ($job) => $job->titleId === $missing->id);
        Queue::assertPushed(RebindKodikTitleJob::class, fn ($job) => $job->titleId === $inactive->id);
    }

    public function test_listing_runs_applies_event_and_run_retention(): void
    {
        $this->actingAs($this->admin());
        $oldRun = $this->syncRun(['created_at' => now()->subDays(91), 'updated_at' => now()->subDays(91)]);
        $keptRun = $this->syncRun();
        CinemaSyncEvent::create([
            'run_id' => $keptRun->id,
            'action' => 'updated',
            'status' => 'succeeded',
            'created_at' => now()->subDays(31),
            'updated_at' => now()->subDays(31),
        ]);

        $this->getJson('/admin/cinema/kodik/runs')->assertOk();

        $this->assertDatabaseMissing('cinema_sync_runs', ['id' => $oldRun->id]);
        $this->assertDatabaseMissing('cinema_sync_events', ['run_id' => $keptRun->id]);
        $this->assertDatabaseHas('cinema_sync_runs', ['id' => $keptRun->id]);
    }

    private function admin(): User
    {
        $this->seed(SystemPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    /** @param array<string, mixed> $changes */
    private function syncRun(array $changes = []): CinemaSyncRun
    {
        return CinemaSyncRun::create(array_replace([
            'source' => 'kodik',
            'mode' => 'incremental',
            'status' => 'succeeded',
            'initiator' => 'admin',
            'counters' => ['queued' => 2],
            'started_at' => now()->subMinute(),
            'finished_at' => now(),
        ], $changes));
    }
}

