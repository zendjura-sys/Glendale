<?php

namespace Tests\Feature;

use App\Models\StaffRole;
use App\Models\User;
use App\Support\Staff\StaffRoles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Ролі команди з адмінки й власна роль-підпис підписника GameCon+. */
class StaffRolesAndTitlesTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_creates_role_and_assigns_it(): void
    {
        $admin = User::factory()->admin()->create();
        $mod = User::factory()->create();
        $this->actingAs(User::factory()->create())->post('/admin/team/roles', ['name' => 'X', 'color' => 'sky'])->assertForbidden();

        $this->actingAs($admin)->post('/admin/team/roles', ['name' => 'Модератор чатів', 'color' => 'emerald', 'sections' => ['chats', 'antispam']])->assertSessionHasNoErrors();
        $role = StaffRole::query()->firstOrFail();

        $this->actingAs($admin)->put("/admin/team/{$mod->username}", ['role' => 'moderator', 'sections' => ['posts'], 'staff_role_id' => $role->id])->assertSessionHasNoErrors();
        $mod->refresh();
        $this->assertEqualsCanonicalizing(['posts', 'chats', 'antispam'], StaffRoles::sections($mod));
        $this->assertSame(['name' => 'Модератор чатів', 'color' => 'emerald'], $mod->toCard()['staff_title']);

        // Видалення ролі: людина лишається модератором з особистими розділами.
        $this->actingAs($admin)->delete("/admin/team/roles/{$role->id}")->assertRedirect();
        $mod->refresh();
        $this->assertTrue($mod->isStaff());
        $this->assertSame(['posts'], StaffRoles::sections($mod));
        $this->assertNull($mod->toCard()['staff_title']);
    }

    public function test_plus_title_once_a_week_and_no_staff_lookalikes(): void
    {
        $plain = User::factory()->create();
        $this->actingAs($plain)->put('/plus/title', ['name' => 'Снайпер'])->assertForbidden();

        $plus = User::factory()->create(['plus_until' => now()->addMonth()]);
        $this->actingAs($plus)->put('/plus/title', ['name' => 'Адмін сервера'])->assertSessionHasErrors('name');
        $this->actingAs($plus)->put('/plus/title', ['name' => 'Снайпер клану', 'color' => 'rose'])->assertSessionHasNoErrors();
        $this->assertSame(['name' => 'Снайпер клану', 'color' => 'rose'], $plus->fresh()->toCard()['title']);

        // Колір — будь-коли, текст — раз на тиждень.
        $this->actingAs($plus)->put('/plus/title', ['name' => 'Снайпер клану', 'color' => 'amber'])->assertSessionHasNoErrors();
        $this->actingAs($plus)->put('/plus/title', ['name' => 'Хілер'])->assertSessionHasErrors('name');
        $this->travel(8)->days();
        $this->actingAs($plus)->put('/plus/title', ['name' => 'Хілер'])->assertSessionHasNoErrors();

        // Без GameCon+ роль не показується.
        $plus->forceFill(['plus_until' => now()->subDay()])->save();
        $this->assertNull($plus->fresh()->toCard()['title']);
    }
}
