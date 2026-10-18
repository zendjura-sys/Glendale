<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Notifications\PostInteraction;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class AppearanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_palette_quiet_hours_and_profile_signals_are_saved(): void
    {
        app(SiteSettings::class)->put(['languages' => [
            ['code' => 'en', 'enabled' => true],
        ]]);
        $user = User::factory()->create();

        $this->actingAs($user)->put('/settings/appearance', [
            'palette' => 'ocean',
            'quiet_enabled' => true,
            'quiet_from' => '23:00',
            'quiet_to' => '08:00',
            'languages' => ['en', 'xx'],
            'looking_for_group' => true,
        ])->assertRedirect();

        $user->refresh();
        $this->assertSame('ocean', $user->palette());
        $this->assertSame(['en'], $user->pref('languages'));
        $this->assertTrue($user->pref('looking_for_group'));

        Carbon::setTestNow(Carbon::parse('2026-10-08 23:30:00'));
        $this->assertTrue($user->inQuietHours());
        $this->assertSame([], (new PostInteraction(PostInteraction::LIKE, $user, Post::make()))->via($user));

        Carbon::setTestNow(Carbon::parse('2026-10-08 12:00:00'));
        $this->assertFalse($user->inQuietHours());
        $this->assertSame(['database'], (new PostInteraction(PostInteraction::LIKE, $user, Post::make()))->via($user));
    }
}
