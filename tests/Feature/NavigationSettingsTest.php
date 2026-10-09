<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class NavigationSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_tabs_are_shared_with_every_page(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('navigation.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('settings/navigation')
                ->where('auth.user.nav_tabs', User::DEFAULT_NAV)
                ->where('max', User::MAX_NAV));
    }

    public function test_user_picks_and_orders_tabs(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->put(route('navigation.update'), ['tabs' => ['music', 'messages', 'cinema']])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame(['music', 'messages', 'cinema'], $user->fresh()->nav_tabs);
        $this->actingAs($user)->get(route('feed'))
            ->assertInertia(fn (Assert $page) => $page->where('auth.user.nav_tabs', ['music', 'messages', 'cinema']));

        $this->actingAs($user)->put(route('navigation.update'), ['tabs' => User::DEFAULT_NAV])->assertRedirect();
        $this->assertNull($user->fresh()->nav_tabs);
    }

    public function test_invalid_choices_are_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->put(route('navigation.update'), ['tabs' => ['music', 'cinema', 'photos', 'servers', 'families']])
            ->assertSessionHasErrors('tabs');
        $this->actingAs($user)->put(route('navigation.update'), ['tabs' => ['music', 'music']])
            ->assertSessionHasErrors('tabs.0');
        $this->actingAs($user)->put(route('navigation.update'), ['tabs' => ['admin']])
            ->assertSessionHasErrors('tabs.0');
        $this->actingAs($user)->put(route('navigation.update'), ['tabs' => []])
            ->assertSessionHasErrors('tabs');

        $this->assertNull($user->fresh()->nav_tabs);
    }

    public function test_disabled_module_leaves_the_bar(): void
    {
        $user = User::factory()->create(['nav_tabs' => ['music', 'people']]);
        $modules = app(ModuleManager::class);

        $modules->set('people', false);
        $this->assertSame(['music'], $modules->navTabsFor($user));

        $modules->set('music', false);
        $this->assertSame(User::DEFAULT_NAV, $modules->navTabsFor($user));
    }

    public function test_app_reads_and_saves_the_same_setting(): void
    {
        $user = User::factory()->create();
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->json('token');

        $this->withToken($token)->getJson('/api/v1/me')->assertJsonPath('user.nav_tabs', User::DEFAULT_NAV);

        $this->withToken($token)->putJson('/api/v1/site/settings/navigation', ['tabs' => ['families', 'feed']])
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->withToken($token)->getJson('/api/v1/me')->assertJsonPath('user.nav_tabs', ['families', 'feed']);
        $this->withToken($token)->putJson('/api/v1/site/settings/navigation', ['tabs' => ['nope']])->assertStatus(422);
    }
}
