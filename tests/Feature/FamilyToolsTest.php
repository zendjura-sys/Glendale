<?php

namespace Tests\Feature;

use Addons\Reports\Models\Report;
use App\Families\FamilyContext;
use App\Models\User;
use Database\Seeders\SystemPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Інструменти системи родин — для кожної родини окремо: звіти, банк та
 * інше однієї родини не видно іншій, лідер і заступники керують лише своєю.
 */
class FamilyToolsTest extends TestCase
{
    use RefreshDatabase;

    private function family(string $name, string $status = 'verified'): int
    {
        return DB::table('families')->insertGetId([
            'name' => $name, 'tag' => strtoupper(substr($name, 0, 3)), 'project' => 'Verba Online', 'server' => '1',
            'description' => '', 'status' => $status, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function member(int $familyId, string $role = 'member', ?User $user = null): User
    {
        $user ??= User::factory()->create();
        DB::table('family_members')->insert(['family_id' => $familyId, 'user_id' => $user->id, 'role' => $role, 'created_at' => now()]);

        return $user;
    }

    private function report(User $user): Report
    {
        $this->actingAs($user);
        FamilyContext::flushCache();

        return Report::create(['user_id' => $user->id, 'submitted_by' => $user->id, 'type' => 'investment', 'amount' => 1000, 'status' => 'pending']);
    }

    public function test_records_are_isolated_per_family(): void
    {
        $a = $this->family('Monsory');
        $b = $this->family('Corleone');
        $alice = $this->member($a);
        $bob = $this->member($b);

        $mine = $this->report($alice);
        $this->assertSame($a, $mine->family_id);
        $theirs = $this->report($bob);
        $this->assertSame($b, $theirs->family_id);

        $this->actingAs($alice);
        FamilyContext::flushCache();
        $this->assertSame([$mine->id], Report::pluck('id')->all());

        $this->actingAs($bob);
        FamilyContext::flushCache();
        $this->assertSame([$theirs->id], Report::pluck('id')->all());
        $this->assertSame(2, Report::withoutFamilyScope()->count());
    }

    public function test_tools_are_only_for_family_members(): void
    {
        $a = $this->family('Monsory');
        $this->family('Pending', 'pending');
        $outsider = User::factory()->create();
        $this->actingAs($outsider)->get('/reports')->assertRedirect('/families');

        $member = $this->member($a);
        $this->actingAs($member)->get('/reports')->assertOk();
    }

    public function test_leader_manages_only_own_family(): void
    {
        $a = $this->family('Monsory');
        $b = $this->family('Corleone');
        $leaderB = $this->member($b, 'leader');
        $memberB = $this->member($b);

        $this->actingAs($leaderB);
        FamilyContext::flushCache();
        $this->assertSame($b, FamilyContext::id());
        $this->assertTrue($leaderB->can('reports.manage'));
        $this->assertTrue($leaderB->can('bonuses.manage'));
        $this->assertFalse($leaderB->can('users.manage'), 'платформні права лідер не отримує');

        $this->actingAs($memberB);
        FamilyContext::flushCache();
        $this->assertFalse($memberB->can('reports.manage'));

        // Лідер B, який став учасником A, в A — звичайний учасник.
        $this->member($a, 'member', $leaderB);
        $this->actingAs($leaderB);
        FamilyContext::run($a, fn () => $this->assertFalse($leaderB->can('reports.manage')));
    }

    public function test_switching_active_family(): void
    {
        $this->seed(SystemPermissionsSeeder::class);
        $a = $this->family('Monsory');
        $b = $this->family('Corleone');
        $c = $this->family('Stranger');
        $user = $this->member($a);
        $this->member($b, 'deputy', $user);

        Sanctum::actingAs($user);
        $this->getJson('/api/v2/me')->assertJsonPath('user.activeFamilyId', $a)->assertJsonPath('user.familyTools', true)->assertJsonPath('user.familyManager', false);

        $this->postJson('/api/v2/me/active-family', ['familyId' => $b])->assertOk()
            ->assertJsonPath('user.activeFamilyId', $b)->assertJsonPath('user.familyManager', true);
        $this->assertSame($b, $user->fresh()->active_family_id);

        $this->postJson('/api/v2/me/active-family', ['familyId' => $c])->assertForbidden();
    }
}
