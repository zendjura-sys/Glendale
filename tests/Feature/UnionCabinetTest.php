<?php

namespace Tests\Feature;

use App\Models\UnionAnnouncement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * /dashboard — спільна адреса: рішення, яку сторінку показати, приймає
 * ПОТОЧНИЙ ДОМЕН (UNION_DOMAIN, union.monsory.test у phpunit.xml), а не
 * тип акаунту — той самий принцип, що й для головної/реєстрації. Тому на
 * union.gamecon.online кабінет союзу бачить БУДЬ-ХТО, навіть учасник родини
 * Monsory, який туди зайшов (union_family_name в нього порожнє).
 */
class UnionCabinetTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_union_member_sees_the_union_cabinet_on_the_union_domain(): void
    {
        $user = User::factory()->create(['union_family_name' => 'Family Corvo', 'union_role' => 'leader']);

        $this->actingAs($user)
            ->get('http://union.monsory.test/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Union/Cabinet', shouldExist: false)
                ->where('family.name', 'Family Corvo'));
    }

    /** Головна гарантія цього фікса: домен вирішує, а не тип акаунту. */
    public function test_a_regular_family_member_also_sees_the_union_cabinet_on_the_union_domain(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('http://union.monsory.test/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Union/Cabinet', shouldExist: false)
                ->where('family.name', null)
                ->has('family.members', 0));
    }

    public function test_a_union_member_sees_the_regular_dashboard_on_the_main_domain(): void
    {
        $user = User::factory()->create(['union_family_name' => 'Family Corvo', 'union_role' => 'leader']);

        $this->actingAs($user)
            ->get('http://localhost/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Dashboard', shouldExist: false));
    }

    public function test_a_regular_family_member_sees_the_regular_dashboard_on_the_main_domain(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('http://localhost/dashboard')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Dashboard', shouldExist: false));
    }

    public function test_the_union_cabinet_lists_family_members_and_published_announcements(): void
    {
        $user = User::factory()->create(['union_family_name' => 'Family Corvo', 'union_role' => 'leader']);
        User::factory()->create(['union_family_name' => 'Family Corvo', 'union_role' => 'member']);
        User::factory()->create(['union_family_name' => 'Family Del Rio', 'union_role' => 'member']);

        UnionAnnouncement::create(['title' => 'Опубліковано', 'body' => 'x', 'published_at' => now()->subDay()]);
        UnionAnnouncement::create(['title' => 'Майбутнє', 'body' => 'x', 'published_at' => now()->addDay()]);

        $this->actingAs($user)
            ->get('http://union.monsory.test/dashboard')
            ->assertInertia(fn ($page) => $page
                ->has('family.members', 2)
                ->where('unionStats.families', 2)
                ->where('unionStats.members', 3)
                ->has('announcements', 1)
                ->where('announcements.0.title', 'Опубліковано'));
    }

    /**
     * where('union_family_name', null) без явної охорони перетворюється на
     * "IS NULL" — без фіксу тут у "родину" учасника Monsory (теж null)
     * підхопило б усіх ІНШИХ учасників Monsory, а не порожній список.
     */
    public function test_a_regular_family_members_roster_does_not_leak_other_monsory_members(): void
    {
        $user = User::factory()->create();
        User::factory()->count(3)->create();

        $this->actingAs($user)
            ->get('http://union.monsory.test/dashboard')
            ->assertInertia(fn ($page) => $page->has('family.members', 0));
    }
}
