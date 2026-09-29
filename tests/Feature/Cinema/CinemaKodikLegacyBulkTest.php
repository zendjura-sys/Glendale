<?php

namespace Tests\Feature\Cinema;

use App\Cinema\CinemaSettings;
use App\Cinema\RebindKodikTitleJob;
use App\Cinema\Title;
use App\Models\User;
use Database\Seeders\SystemPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class CinemaKodikLegacyBulkTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_kodik_button_queues_all_missing_titles_through_sync_run(): void
    {
        $this->seed(SystemPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->actingAs($admin);
        CinemaSettings::setSecret(CinemaSettings::KODIK_TOKEN, 'test-token');
        Queue::fake();

        foreach (array_chunk(range(1, 501), 100) as $chunk) {
            Title::query()->insert(array_map(fn (int $id) => [
                'tmdb_id' => 20000 + $id,
                'type' => 'movie',
                'name' => 'Назва '.$id,
                'created_at' => now(),
                'updated_at' => now(),
            ], $chunk));
        }

        $this->post('/admin/cinema/bulk-attach-players', ['source' => 'kodik'])
            ->assertRedirect()->assertSessionHasNoErrors();

        $this->assertDatabaseHas('cinema_sync_runs', [
            'source' => 'kodik', 'mode' => 'rebind_missing', 'initiator' => 'admin',
        ]);
        Queue::assertPushed(RebindKodikTitleJob::class, 501);
    }
}
