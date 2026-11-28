<?php

namespace Tests\Feature;

use App\Jobs\RefreshMoviePlayers;
use App\Models\Movie;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/** №266: масові дії з тайтлами в адмінці. */
class AdminCinemaBulkTest extends TestCase
{
    use RefreshDatabase;

    public function test_bulk_publish_hide_and_refresh(): void
    {
        Queue::fake();
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $a = Movie::query()->create(['slug' => 'a', 'type' => 'movie', 'title' => 'А', 'is_published' => false]);
        $b = Movie::query()->create(['slug' => 'b', 'type' => 'movie', 'title' => 'Б', 'is_published' => false]);

        $this->actingAs(User::factory()->create())->post('/admin/cinema/bulk', ['ids' => [$a->id], 'action' => 'publish'])->assertForbidden();
        $this->actingAs($admin)->post('/admin/cinema/bulk', ['ids' => [$a->id], 'action' => 'delete'])->assertSessionHasErrors('action');

        $this->actingAs($admin)->post('/admin/cinema/bulk', ['ids' => [$a->id, $b->id], 'action' => 'publish'])->assertRedirect();
        $this->assertTrue($a->fresh()->is_published && $b->fresh()->is_published);
        $this->actingAs($admin)->post('/admin/cinema/bulk', ['ids' => [$b->id], 'action' => 'hide']);
        $this->assertFalse($b->fresh()->is_published);
        $this->actingAs($admin)->post('/admin/cinema/bulk', ['ids' => [$a->id, $b->id], 'action' => 'refresh']);
        Queue::assertPushed(RefreshMoviePlayers::class, 2);
    }
}
