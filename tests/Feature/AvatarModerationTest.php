<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\SystemPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Аватарки учасників публікуються в каруселі на головній лише після
 * підтвердження адміном (avatar_approved) — без цього щойно завантажене
 * фото одразу опинялось б на публічній сторінці без жодної перевірки.
 *
 * test_admin_can_approve_a_pending_avatar — регресія на реальний баг:
 * approveAvatar()/rejectAvatar() спочатку писали через update(), а
 * avatar_approved навмисно не в $fillable — mass assignment мовчки
 * ігнорував зміну, підтвердження виглядало успішним, але нічого не
 * змінювало. Знайдено живим тестуванням, не переглядом коду.
 */
class AvatarModerationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function admin(): User
    {
        $this->seed(SystemPermissionsSeeder::class);
        $admin = User::factory()->create(['email_verified_at' => now()]);
        $admin->assignRole('admin');

        return $admin;
    }

    public function test_uploading_a_new_avatar_is_pending_by_default(): void
    {
        $member = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($member)->post(route('profile.avatar'), [
            'avatar' => UploadedFile::fake()->image('me.jpg'),
        ]);

        $member->refresh();
        $this->assertNotNull($member->avatar_path);
        $this->assertFalse($member->avatar_approved);
    }

    public function test_a_pending_avatar_is_not_shown_on_the_homepage(): void
    {
        $member = User::factory()->create(['email_verified_at' => now()]);
        $this->actingAs($member)->post(route('profile.avatar'), [
            'avatar' => UploadedFile::fake()->image('me.jpg'),
        ]);

        // Головна-лендинг — для гостей; той, хто увійшов, потрапляє в стрічку.
        auth()->guard('web')->logout();
        $response = $this->get('/');

        $response->assertInertia(fn ($page) => $page->where('memberPhotos', []));
    }

    public function test_admin_can_approve_a_pending_avatar(): void
    {
        $admin = $this->admin();
        $member = User::factory()->create(['email_verified_at' => now()]);
        $this->actingAs($member)->post(route('profile.avatar'), [
            'avatar' => UploadedFile::fake()->image('me.jpg'),
        ]);
        $member->refresh();

        $this->actingAs($admin)->post(route('admin.design.avatars.approve', $member))->assertRedirect();

        $this->assertTrue($member->fresh()->avatar_approved);
    }

    public function test_approved_avatar_appears_on_the_homepage(): void
    {
        $admin = $this->admin();
        $member = User::factory()->create(['name' => 'Approved Member', 'email_verified_at' => now()]);
        $this->actingAs($member)->post(route('profile.avatar'), [
            'avatar' => UploadedFile::fake()->image('me.jpg'),
        ]);
        $this->actingAs($admin)->post(route('admin.design.avatars.approve', $member->fresh()));

        // Головна-лендинг — для гостей; той, хто увійшов, потрапляє в стрічку.
        auth()->guard('web')->logout();
        $response = $this->get('/');

        $response->assertInertia(fn ($page) => $page->has('memberPhotos', 1));
    }

    public function test_admin_can_reject_a_pending_avatar_and_the_file_is_deleted(): void
    {
        $admin = $this->admin();
        $member = User::factory()->create(['email_verified_at' => now()]);
        $this->actingAs($member)->post(route('profile.avatar'), [
            'avatar' => UploadedFile::fake()->image('me.jpg'),
        ]);
        $path = $member->fresh()->avatar_path;
        Storage::disk('public')->assertExists($path);

        $this->actingAs($admin)->delete(route('admin.design.avatars.reject', $member->fresh()))->assertRedirect();

        $member->refresh();
        $this->assertNull($member->avatar_path);
        $this->assertFalse($member->avatar_approved);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_uploading_a_replacement_avatar_resets_approval(): void
    {
        $admin = $this->admin();
        $member = User::factory()->create(['email_verified_at' => now()]);
        $this->actingAs($member)->post(route('profile.avatar'), [
            'avatar' => UploadedFile::fake()->image('first.jpg'),
        ]);
        $this->actingAs($admin)->post(route('admin.design.avatars.approve', $member->fresh()));
        $this->assertTrue($member->fresh()->avatar_approved);

        // actingAs() тримає саме цей PHP-об'єкт як залогіненого юзера на
        // весь тест — без ->fresh() тут він і далі "пам'ятав" би
        // avatar_approved=false зі свого попереднього стану (в реальному
        // HTTP-запиті користувача так само підвантажують заново з сесії,
        // тому тут це лише коректність тесту, не бага контролера).
        $this->actingAs($member->fresh())->post(route('profile.avatar'), [
            'avatar' => UploadedFile::fake()->image('second.jpg'),
        ]);

        $this->assertFalse($member->fresh()->avatar_approved);
    }
}
