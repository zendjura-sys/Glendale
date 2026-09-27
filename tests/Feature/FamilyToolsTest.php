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

    public function test_family_profile_content_rules_and_positions_are_per_family(): void
    {
        $this->seed(SystemPermissionsSeeder::class);
        $a = $this->family('Monsory');
        $b = $this->family('Corleone');
        $leaderB = $this->member($b, 'leader');
        $memberB = $this->member($b);
        $memberA = $this->member($a);

        // Нова родина — типові посади, не посади Monsory.
        $this->actingAs($leaderB);
        FamilyContext::flushCache();
        $this->get('/admin/family-profile')->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/FamilyProfile/Index', false)
                ->where('family.name', 'Corleone')
                ->where('content.positions.0.key', 'newcomer'));

        $this->put('/admin/family-profile/content', [
            'about' => ['Сицилійська родина'],
            'leadership' => [],
            'positions' => [['key' => 'soldier', 'title' => 'Солдат'], ['key' => 'capo', 'title' => 'Капо']],
            'promotionCriteria' => ['Активність'],
        ])->assertSessionHasNoErrors();
        $this->put('/admin/family-profile/rules', ['rules' => "# 1. Омерта\n**1.1 Мовчання**"])->assertSessionHasNoErrors();
        $this->put("/admin/family-profile/members/{$memberB->id}/position", ['positionKey' => 'capo'])->assertSessionHasNoErrors();
        $this->put("/admin/family-profile/members/{$memberA->id}/position", ['positionKey' => 'capo'])->assertNotFound();

        FamilyContext::flushCache();
        $this->assertSame(['Сицилійська родина'], \App\Support\FamilyContent::about());
        $this->assertSame('capo', $memberB->fresh()->position_key);
        $this->assertSame('Правила родини Corleone', \App\Support\FamilyRules::payload()['books'][0]['title']);

        // У Monsory — свій контент, правки Corleone його не зачепили.
        $this->actingAs($memberA);
        FamilyContext::flushCache();
        $this->assertNotSame(['Сицилійська родина'], \App\Support\FamilyContent::about());
        $this->assertSame('monsory', \App\Support\FamilyRules::payload()['books'][0]['slug']);

        // Звичайний учасник профіль родини не редагує.
        $this->actingAs($memberB);
        FamilyContext::flushCache();
        $this->get('/admin/family-profile')->assertForbidden();
    }
}

