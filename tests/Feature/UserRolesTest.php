<?php

namespace Tests\Feature;

use App\Models\PaymentOrder;
use App\Models\User;
use App\Models\UserRole;
use App\Services\Profile\UserRoles;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Ролі-плашки користувачів: видача вручну, автоматичні правила, святкові дати, аудит доступу. */
class UserRolesTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<int, array{id: int, name: string, kind: string, color: string, icon: string|null, description: string|null}> */
    private function rolesOf(User $user): array
    {
        return app()->make(UserRoles::class)->of($user->fresh());
    }

    public function test_only_admin_manages_roles_and_manual_grant_works(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();
        $this->actingAs($user)->post('/admin/roles', ['name' => 'old', 'kind' => 'regular', 'color' => 'sky', 'priority' => 1, 'rule' => 'manual'])->assertForbidden();

        $this->actingAs($admin)->post('/admin/roles', ['name' => 'Big Sponsor', 'kind' => 'regular', 'color' => 'amber', 'icon' => 'crown', 'priority' => 1, 'rule' => 'manual'])->assertSessionHasNoErrors();
        $role = UserRole::query()->firstOrFail();
        $this->withoutVite()->actingAs($admin)->get('/admin/roles')->assertOk();

        $this->actingAs($admin)->post("/admin/roles/{$role->id}/grant", ['username' => '@'.$user->username])->assertSessionHasNoErrors();
        app()->forgetScopedInstances();
        $this->assertSame(['Big Sponsor'], array_column($this->rolesOf($user), 'name'));
        $this->assertSame('Big Sponsor', $user->fresh()->toCard()['roles'][0]['name']);

        $this->actingAs($admin)->delete("/admin/roles/{$role->id}/users/{$user->id}")->assertRedirect();
        app()->forgetScopedInstances();
        $this->assertSame([], $this->rolesOf($user));
    }

    public function test_live_rules_plus_and_account_age(): void
    {
        UserRole::query()->create(['name' => 'Plus', 'kind' => 'premium', 'color' => 'violet', 'priority' => 1, 'rule' => 'plus']);
        UserRole::query()->create(['name' => 'old', 'kind' => 'regular', 'color' => 'slate', 'priority' => 2, 'rule' => 'account_years', 'rule_value' => '2']);
        UserRoles::forget();

        $fresh = User::factory()->create();
        $veteran = User::factory()->create(['created_at' => now()->subYears(3), 'plus_until' => now()->addMonth()]);

        $this->assertSame([], $this->rolesOf($fresh));
        $this->assertSame(['Plus', 'old'], array_column($this->rolesOf($veteran), 'name'));
    }

    public function test_holiday_role_only_within_dates(): void
    {
        $user = User::factory()->create();
        $role = UserRole::query()->create(['name' => 'Новий рік', 'kind' => 'holiday', 'color' => 'rose', 'priority' => 1, 'rule' => 'manual',
            'active_from' => now()->addDays(5)->toDateString(), 'active_until' => now()->addDays(10)->toDateString()]);
        $role->users()->attach($user->id, ['auto' => false]);
        UserRoles::forget();
        $this->assertSame([], $this->rolesOf($user));

        $role->update(['active_from' => now()->subDay()->toDateString()]);
        UserRoles::forget();
        app()->forgetScopedInstances();
        $this->assertSame(['Новий рік'], array_column($this->rolesOf($user), 'name'));
    }

    public function test_nightly_sync_grants_and_revokes_support_role_but_keeps_manual(): void
    {
        $role = UserRole::query()->create(['name' => 'Меценат', 'kind' => 'award', 'color' => 'amber', 'priority' => 1, 'rule' => 'spent', 'rule_value' => '100']);
        UserRoles::forget();
        $donor = User::factory()->create(['last_seen_at' => now()]);
        $manual = User::factory()->create(['last_seen_at' => now()]);
        $role->users()->attach($manual->id, ['auto' => false]);
        $order = PaymentOrder::query()->create(['code' => Str::random(12), 'user_id' => $donor->id, 'kind' => 'plus', 'product' => 'plus_month', 'target_type' => 'user', 'target_id' => $donor->id, 'price' => 15000, 'amount' => 15000, 'status' => PaymentOrder::PAID, 'expires_at' => now()->addHour(), 'paid_at' => now()]);

        $this->assertSame(1, app(UserRoles::class)->sync());
        $this->assertTrue($role->users()->whereKey($donor->id)->exists());

        $order->update(['status' => 'refunded']);
        $this->assertSame(1, app(UserRoles::class)->sync());
        $this->assertFalse($role->users()->whereKey($donor->id)->exists());
        $this->assertTrue($role->users()->whereKey($manual->id)->exists());
    }
}
