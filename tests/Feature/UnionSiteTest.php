<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/**
 * union.gamecon.online (UNION_DOMAIN, встановлений у phpunit.xml для тестів)
 * — той самий застосунок, база й логін, різниться лише ця публічна
 * сторінка. Перевіряємо: сторінка рендериться на union-домені, головний
 * домен її не показує, а адмінка редагує текст лише коли фіча увімкнена.
 */
class UnionSiteTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $permission = Permission::firstOrCreate(['name' => 'union.manage', 'guard_name' => 'web']);
        $role = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $role->givePermissionTo($permission);

        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_the_union_homepage_renders_on_the_union_domain(): void
    {
        $this->get('http://union.monsory.test/')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Union/Home', shouldExist: false)
                ->has('title')
                ->has('about')
                ->has('rules')
                ->has('terms'));
    }

    public function test_the_main_domain_still_shows_the_regular_home_page(): void
    {
        $this->get('http://localhost/')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Home', shouldExist: false));
    }

    public function test_login_works_the_same_from_the_union_domain(): void
    {
        $this->get('http://union.monsory.test/login')->assertOk();
    }

    public function test_an_admin_can_edit_the_union_page_text(): void
    {
        $this->actingAs($this->admin())
            ->put(route('admin.union.content'), [
                'title' => 'Союзники Monsory',
                'tagline' => 'Разом сильніші',
                'about' => ['Перший абзац.', 'Другий абзац.'],
                'rules' => ['Правило.'],
                'terms' => ['Умова.'],
            ])
            ->assertRedirect();

        $this->get('http://union.monsory.test/')
            ->assertInertia(fn ($page) => $page
                ->where('title', 'Союзники Monsory')
                ->where('tagline', 'Разом сильніші')
                ->where('about', ['Перший абзац.', 'Другий абзац.']));
    }

    public function test_a_member_without_union_manage_permission_cannot_edit_the_union_page(): void
    {
        $this->actingAs(User::factory()->create())
            ->put(route('admin.union.content'), ['title' => 'x', 'about' => [], 'rules' => [], 'terms' => []])
            ->assertForbidden();
    }
}
