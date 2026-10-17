<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Backgrounds;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BackgroundSettingsTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function form(array $extra = []): array
    {
        return [
            'palette' => 'aurora',
            'quiet_enabled' => false,
            'quiet_from' => '23:00',
            'quiet_to' => '08:00',
            'looking_for_group' => false,
            ...$extra,
        ];
    }

    public function test_youtube_links_are_reduced_to_an_id(): void
    {
        foreach ([
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
            'youtu.be/dQw4w9WgXcQ',
            'https://youtube.com/shorts/dQw4w9WgXcQ',
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
            'https://m.youtube.com/live/dQw4w9WgXcQ?feature=share',
            'dQw4w9WgXcQ',
        ] as $url) {
            $this->assertSame('dQw4w9WgXcQ', Backgrounds::youtubeId($url), $url);
        }
        foreach (['', 'https://vimeo.com/123', 'https://evil.example/watch?v=dQw4w9WgXcQ', 'javascript:alert(1)', 'https://youtube.com/watch?v=short'] as $url) {
            $this->assertNull(Backgrounds::youtubeId($url), $url);
        }
    }

    public function test_preset_and_motion_are_saved_and_shared(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->put('/settings/appearance', $this->form([
            'background' => 'night',
            'background_motion' => false,
        ]))->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame(['preset' => 'night', 'motion' => false, 'video' => null], Backgrounds::for($user->refresh()));
        $this->actingAs($user)->get('/settings/appearance')
            ->assertInertia(fn ($page) => $page->where('auth.user.background.preset', 'night'));

        $this->actingAs($user)->put('/settings/appearance', $this->form(['background' => 'lava']))
            ->assertSessionHasErrors('background');
    }

    public function test_video_background_needs_gameconplus(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->put('/settings/appearance', $this->form([
            'background_video' => 'https://youtu.be/dQw4w9WgXcQ',
        ]))->assertSessionHasErrors('background_video');
        $this->assertNull($user->refresh()->pref('background_video'));

        $user->forceFill(['plus_until' => now()->addMonth()])->save();
        $this->actingAs($user)->put('/settings/appearance', $this->form([
            'background_video' => 'https://youtu.be/dQw4w9WgXcQ',
        ]))->assertSessionHasNoErrors();
        $this->assertSame('dQw4w9WgXcQ', Backgrounds::for($user->refresh())['video']);

        $this->actingAs($user)->put('/settings/appearance', $this->form([
            'background_video' => 'https://vimeo.com/1',
        ]))->assertSessionHasErrors('background_video');

        // Підписка скінчилася: відео не показується, але прибрати його можна.
        $user->forceFill(['plus_until' => now()->subDay()])->save();
        $this->assertNull(Backgrounds::for($user->refresh())['video']);
        $this->actingAs($user)->put('/settings/appearance', $this->form(['background_video' => '']))
            ->assertSessionHasNoErrors();
        $this->assertNull($user->refresh()->pref('background_video'));
    }
}
