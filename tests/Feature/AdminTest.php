<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Support\Modules\ModuleManager;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_regular_users_cannot_open_the_admin_panel(): void
    {
        $this->actingAs(User::factory()->create())->get(route('admin.dashboard'))->assertForbidden();
    }

    public function test_admin_pages_render(): void
    {
        $admin = User::factory()->admin()->create();

        foreach (['admin.dashboard', 'admin.users.index', 'admin.posts.index', 'admin.modules.index', 'admin.settings.edit'] as $route) {
            $this->actingAs($admin)->get(route($route))->assertOk();
        }
    }

    public function test_disabling_a_module_hides_its_pages_and_menu_entry(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->patch(route('admin.modules.update', 'people'), ['enabled' => false])->assertRedirect();

        $this->assertFalse(app(ModuleManager::class)->enabled('people'));
        $this->actingAs($admin)->get(route('people.index'))->assertNotFound();
        $this->actingAs($admin)->get(route('feed'))
            ->assertInertia(fn (Assert $page) => $page->where('nav', fn ($nav) => collect($nav)->doesntContain('key', 'people')));
    }

    public function test_core_and_unavailable_modules_cannot_be_toggled(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->patch(route('admin.modules.update', 'feed'), ['enabled' => false])->assertStatus(422);
        $this->actingAs($admin)->patch(route('admin.modules.update', 'cinema'), ['enabled' => true])->assertStatus(422);
    }

    public function test_banned_user_is_logged_out(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();

        $this->actingAs($admin)->patch(route('admin.users.update', $user), ['banned' => true, 'ban_reason' => 'Спам'])->assertRedirect();
        $this->assertTrue($user->fresh()->isBanned());

        $this->actingAs($user->fresh())->get(route('feed'))->assertRedirect(route('login'));
        $this->assertGuest();
    }

    public function test_admin_cannot_ban_or_demote_themselves(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->patch(route('admin.users.update', $admin), ['role' => 'user'])->assertStatus(422);
        $this->actingAs($admin)->delete(route('admin.users.destroy', $admin))->assertStatus(422);
    }

    public function test_posts_go_to_trash_before_permanent_deletion(): void
    {
        $admin = User::factory()->admin()->create();
        $post = Post::factory()->create();

        $this->actingAs($admin)->delete(route('admin.posts.destroy', $post->id));
        $this->assertSoftDeleted($post);

        $this->actingAs($admin)->post(route('admin.posts.restore', $post->id));
        $this->assertNotSoftDeleted($post);

        $this->actingAs($admin)->delete(route('admin.posts.destroy', $post->id));
        $this->actingAs($admin)->delete(route('admin.posts.destroy', $post->id));
        $this->assertModelMissing($post);
    }

    public function test_closing_registration_blocks_sign_up(): void
    {
        app(SiteSettings::class)->put(['registration_open' => false]);

        $this->post(route('register.store'), [
            'first_name' => 'Ігор',
            'last_name' => 'Тест',
            'email' => 'igor@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_site_settings_can_be_updated(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->put(route('admin.settings.update'), [
            'site_name' => 'GameCon UA',
            'tagline' => 'Тест',
            'registration_open' => true,
            'email_verification' => false,
            'max_post_length' => 3000,
            'max_attachments' => 6,
            'max_upload_mb' => 15,
            'max_message_file_mb' => 40,
            'music_max_track_mb' => 25,
            'maintenance_message' => 'Технічні роботи о 03:00',
        ])->assertSessionHasNoErrors();

        $this->actingAs($admin)->get(route('feed'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('site.name', 'GameCon UA')
                ->where('site.announcement', 'Технічні роботи о 03:00'));
    }

    public function test_email_verification_setting_gates_the_site(): void
    {
        $user = User::factory()->unverified()->create();
        $this->actingAs($user)->get(route('feed'))->assertOk();

        app(SiteSettings::class)->put(['email_verification' => true]);
        $this->actingAs($user)->get(route('feed'))->assertRedirect(route('verification.notice'));
    }
}
