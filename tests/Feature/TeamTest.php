<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TeamTest extends TestCase
{
    use RefreshDatabase;

    public function test_moderator_sees_only_delegated_sections(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $mod = User::factory()->create(['role' => 'moderator']);
        $this->actingAs($mod)->get('/admin/moderation')->assertForbidden();

        $this->actingAs($admin)->put("/admin/team/{$mod->username}", ['role' => 'moderator', 'sections' => ['moderation', 'cinema']])->assertRedirect();
        $this->actingAs($admin)->put("/admin/team/{$mod->username}", ['role' => 'moderator', 'sections' => ['system']])->assertSessionHasErrors();

        $mod->refresh();
        $this->actingAs($mod)->get('/admin')->assertRedirect('/admin/moderation');
        $this->actingAs($mod)->get('/admin/moderation')->assertOk()->assertInertia(fn (Assert $p) => $p->where('staffSections', ['moderation', 'cinema']));
        $this->actingAs($mod)->get('/admin/cinema')->assertOk();
        $this->actingAs($mod)->get('/admin/system')->assertForbidden();
        $this->actingAs($mod)->get('/admin/users')->assertForbidden();
        $this->actingAs($mod)->get('/admin/team')->assertForbidden();
        // Адміністратор не може сам зняти з себе роль.
        $this->actingAs($admin)->putJson("/admin/team/{$admin->username}", ['role' => 'moderator', 'sections' => []])->assertStatus(422);
    }

    public function test_funnel_counts_steps(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'created_at' => now()->subYear()]);
        $new = User::factory()->create(['email_verified_at' => now(), 'preferences' => ['onboarded' => true]]);
        User::factory()->create(['email_verified_at' => null]);
        Post::factory()->create(['author_id' => $new->id, 'wall_id' => $new->id]);
        $this->actingAs($admin)->get('/admin/funnel?days=30')->assertInertia(fn (Assert $p) => $p
            ->component('admin/funnel')
            ->where('steps.0.count', 2)
            ->where('steps.2.count', 1)
            ->where('steps.4.count', 1));
    }

    public function test_view_as_is_read_only_and_hides_private_areas(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $target = User::factory()->create(['username' => 'olena']);
        $this->actingAs($admin)->post("/admin/view-as/{$target->username}")->assertRedirect('/feed');

        $this->actingAs($admin)->get('/feed')->assertOk()->assertInertia(fn (Assert $p) => $p
            ->where('auth.user.id', $target->id)->where('viewAs.username', 'olena'));
        $this->actingAs($admin)->get('/messages')->assertForbidden();
        $this->actingAs($admin)->post('/posts', ['body' => 'Не має пройти'])->assertForbidden();
        $this->assertSame(0, Post::query()->count());
        // Адмінка — від себе.
        $this->actingAs($admin)->get('/admin/users')->assertOk();

        $this->actingAs($admin)->get('/view-as/stop')->assertRedirect('/admin/users');
        $this->actingAs($admin)->get('/feed')->assertInertia(fn (Assert $p) => $p->where('auth.user.id', $admin->id)->where('viewAs', null));
        // Іншого адміністратора — не можна.
        $other = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->postJson("/admin/view-as/{$other->username}")->assertStatus(422);
    }
}
