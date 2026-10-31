<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Швидкий статус з емодзі й таймером. */
class StatusEmojiTest extends TestCase
{
    use RefreshDatabase;

    public function test_status_with_timer_shows_and_then_hides(): void
    {
        $user = User::factory()->create(['username' => 'raider']);
        $viewer = User::factory()->create();

        $this->actingAs($user)->putJson('/me/status', ['emoji' => '⚔️', 'text' => 'У рейді', 'duration' => '1h'])->assertOk()
            ->assertJsonPath('status.emoji', '⚔️')->assertJsonPath('status.text', 'У рейді');
        $this->assertTrue($user->fresh()->status_until->between(now()->addMinutes(59), now()->addMinutes(61)));

        $this->actingAs($viewer)->get('/raider')->assertInertia(fn (Assert $page) => $page
            ->where('profile.status_emoji', '⚔️')->where('profile.status', 'У рейді'));

        $this->travel(2)->hours();
        $this->actingAs($viewer)->get('/raider')->assertInertia(fn (Assert $page) => $page
            ->where('profile.status_emoji', null)->where('profile.status', null));
    }

    public function test_forever_status_and_clearing(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/me/status', ['emoji' => '🇺🇦', 'text' => '', 'duration' => 'forever'])->assertOk()
            ->assertJsonPath('status.until', null)->assertJsonPath('status.text', null);
        $this->assertSame('🇺🇦', $user->fresh()->status_emoji);

        $this->actingAs($user)->deleteJson('/me/status')->assertOk();
        $this->assertNull($user->fresh()->status_emoji);
    }

    public function test_validation_settings_override_bridge_and_plugin(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/me/status', ['emoji' => 'abc', 'duration' => '1h'])->assertUnprocessable();
        $this->actingAs($user)->putJson('/me/status', ['emoji' => null, 'text' => ' ', 'duration' => '1h'])->assertStatus(422);
        $this->actingAs($user)->putJson('/me/status', ['emoji' => '🎮', 'duration' => 'year'])->assertUnprocessable();

        // Статус, змінений у налаштуваннях профілю, — без таймера.
        $this->actingAs($user)->putJson('/me/status', ['emoji' => '🎮', 'text' => 'Граю', 'duration' => '4h'])->assertOk();
        $this->actingAs($user)->patch('/settings/profile', [
            'first_name' => $user->first_name, 'last_name' => $user->last_name, 'username' => $user->username,
            'email' => $user->email, 'status' => 'Завжди тут',
        ])->assertRedirect();
        $this->assertNull($user->fresh()->status_until);

        $token = app(ApiTokens::class)->issue($user, 'android');
        $this->withToken($token)->putJson('/api/v1/site/me/status', ['emoji' => '💤', 'duration' => 'today'])->assertOk()->assertJsonPath('status.emoji', '💤');

        app(Plugins::class)->set('status_emoji', false);
        $this->actingAs($user)->putJson('/me/status', ['emoji' => '🎮', 'duration' => '1h'])->assertNotFound();
    }
}
