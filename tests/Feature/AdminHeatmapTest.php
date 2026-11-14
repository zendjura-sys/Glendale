<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Теплова карта активності в адмінці: дні × години за Києвом (з літнім часом). */
class AdminHeatmapTest extends TestCase
{
    use RefreshDatabase;

    public function test_heatmap_counts_activity_in_kyiv_time(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-27 12:00', 'UTC'));
        $author = User::factory()->create();
        // Середа 21.10, 09:30 UTC = 12:30 за Києвом (літній час, +3).
        foreach (range(1, 3) as $i) {
            Post::query()->create(['author_id' => $author->id, 'wall_type' => 'user', 'wall_id' => $author->id, 'body' => "Пост $i", 'visibility' => 'public'])
                ->forceFill(['created_at' => CarbonImmutable::parse('2026-10-21 09:30', 'UTC')])->save();
        }
        // Понеділок 26.10, 09:30 UTC = 11:30 за Києвом (зимовий час, +2).
        Post::query()->create(['author_id' => $author->id, 'wall_type' => 'user', 'wall_id' => $author->id, 'body' => 'Ще', 'visibility' => 'public'])
            ->forceFill(['created_at' => CarbonImmutable::parse('2026-10-26 09:30', 'UTC')])->save();

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get('/admin')->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('heatmap', fn (Assert $reload) => $reload
                ->where('heatmap.grid.2.12', 3)
                ->where('heatmap.grid.0.11', 1)
                ->where('heatmap.max', 3)
                ->where('heatmap.peak', ['day' => 2, 'hour' => 12])
                ->where('heatmap.total', 4)));
    }
}
