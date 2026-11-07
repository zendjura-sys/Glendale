<?php

namespace Tests\Feature;

use App\Http\Controllers\Admin\ModerationController;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\System\Backups;
use App\Services\System\ErrorJournal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class SystemOpsTest extends TestCase
{
    use RefreshDatabase;

    public function test_error_journal_groups_server_errors_and_skips_expected_ones(): void
    {
        $journal = app(ErrorJournal::class);
        $boom = fn () => new RuntimeException('База не відповідає');
        $journal->record($boom());
        $journal->record($boom());
        $journal->record(new NotFoundHttpException);
        $this->assertSame(1, DB::table('error_logs')->count());

        // Справжній збій у запиті потрапляє в журнал через обробник винятків.
        Route::get('/__boom', fn () => throw new RuntimeException('Збій у запиті'))->middleware('web');
        $this->get('/__boom')->assertStatus(500);
        $this->assertSame(2, DB::table('error_logs')->count());

        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get('/admin/system')->assertInertia(fn (Assert $p) => $p
            ->component('admin/system')->where('stats.open', 2)->has('errors', 2));
        $id = (int) DB::table('error_logs')->where('message', 'База не відповідає')->value('id');
        $this->actingAs($admin)->post("/admin/system/errors/{$id}/resolve")->assertRedirect();
        $this->actingAs($admin)->get('/admin/system')->assertInertia(fn (Assert $p) => $p->where('stats.open', 1));
        // Повторилася — знову відкрита.
        $journal->record($boom());
        $this->assertNull(DB::table('error_logs')->where('id', $id)->value('resolved_at'));
    }

    public function test_backups_are_admin_only_and_downloadable(): void
    {
        Storage::fake('local');
        $moderator = User::factory()->create(['role' => 'moderator']);
        $this->actingAs($moderator)->get('/admin/system')->assertForbidden();

        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->post('/admin/system/backups')->assertRedirect();
        $list = app(Backups::class)->list();
        $this->assertCount(1, $list);
        $this->actingAs($admin)->get('/admin/system/backups/'.$list[0]['name'])->assertOk();
        $this->actingAs($admin)->get('/admin/system/backups/..%2F.env')->assertNotFound();
    }

    public function test_section_maintenance_hides_module_from_people_but_not_staff(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create();
        $this->actingAs($admin)->put('/admin/modules/cinema/maintenance', ['on' => true, 'message' => 'Оновлюємо плеєри до 18:00'])->assertRedirect();

        $this->actingAs($user)->get('/cinema')->assertStatus(503)->assertInertia(fn (Assert $p) => $p->component('error')->where('message', 'Оновлюємо плеєри до 18:00'));
        $this->withToken(app(ApiTokens::class)->issue($user, 'android'))->getJson('/api/v1/site/cinema')->assertStatus(503)->assertJsonPath('message', 'Оновлюємо плеєри до 18:00');
        $this->actingAs($admin)->get('/cinema')->assertOk();

        $this->actingAs($admin)->put('/admin/modules/cinema/maintenance', ['on' => false])->assertRedirect();
        $this->actingAs($user)->get('/cinema')->assertOk();
    }

    public function test_moderation_queue_puts_child_safety_first(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get('/admin/moderation')->assertInertia(fn (Assert $p) => $p->has('queue'));
        $queue = ModerationController::queue(
            collect([
                ['id' => 1, 'reasons' => collect(['Спам']), 'urgent' => false, 'ai' => null, 'trusted' => false, 'count' => 1, 'created_at' => now()->toIso8601String(), 'message' => ['author' => ['name' => 'А']]],
                ['id' => 2, 'reasons' => collect(['Загроза дитині']), 'urgent' => true, 'ai' => null, 'trusted' => false, 'count' => 1, 'created_at' => now()->toIso8601String(), 'message' => ['author' => ['name' => 'Б']]],
            ]),
            collect(),
            collect([['id' => 9, 'kind' => 'Бан', 'user' => ['name' => 'В'], 'overdue' => true, 'created_at' => now()->subDays(3)->toIso8601String()]]),
            collect(),
        );
        $this->assertSame(['report', 2, 'critical'], [$queue[0]['kind'], $queue[0]['id'], $queue[0]['level']]);
        $this->assertSame('appeal', $queue[1]['kind']);
    }
}
