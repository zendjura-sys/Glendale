<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\VideoBackground;
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

    private function video(): VideoBackground
    {
        $video = VideoBackground::create(['title' => 'Неон', 'mobile_path' => 'backgrounds/videos/m.mp4', 'desktop_path' => 'backgrounds/videos/d.mp4', 'poster_path' => 'backgrounds/videos/p.webp']);
        Backgrounds::forgetVideos();

        return $video;
    }

    public function test_video_background_needs_gameconplus(): void
    {
        $user = User::factory()->create();
        $video = $this->video();

        $this->actingAs($user)->put('/settings/appearance', $this->form(['background_video' => $video->id]))
            ->assertSessionHasErrors('background_video');
        $this->assertNull($user->refresh()->pref('background_video'));

        $user->forceFill(['plus_until' => now()->addMonth()])->save();
        $this->actingAs($user)->put('/settings/appearance', $this->form(['background_video' => $video->id]))
            ->assertSessionHasNoErrors();
        $this->assertSame($video->id, Backgrounds::for($user->refresh())['video']['id'] ?? null);

        // Посилання YouTube і неіснуючі відеофони більше не приймаються.
        $this->actingAs($user)->put('/settings/appearance', $this->form(['background_video' => 'https://youtu.be/dQw4w9WgXcQ']))
            ->assertSessionHasErrors('background_video');
        $this->actingAs($user)->put('/settings/appearance', $this->form(['background_video' => 999]))
            ->assertSessionHasErrors('background_video');

        // Підписка скінчилася: відео не показується, але прибрати його можна.
        $user->forceFill(['plus_until' => now()->subDay()])->save();
        $this->assertNull(Backgrounds::for($user->refresh())['video']);
        $this->actingAs($user)->put('/settings/appearance', $this->form(['background_video' => null]))
            ->assertSessionHasNoErrors();
        $this->assertNull($user->refresh()->pref('background_video'));
    }

    public function test_old_youtube_choice_is_ignored(): void
    {
        $user = User::factory()->create(['plus_until' => now()->addMonth()]);
        $user->mergePref(['background_video' => 'dQw4w9WgXcQ']);
        $this->assertNull(Backgrounds::for($user->refresh())['video']);
    }

    public function test_plus_members_video_background_is_shown_on_their_profile(): void
    {
        $video = $this->video();
        $owner = User::factory()->create(['plus_until' => now()->addMonth()]);
        $owner->mergePref(['background_video' => $video->id]);
        $guest = User::factory()->create();

        $this->actingAs($guest)->get('/'.$owner->username)
            ->assertInertia(fn ($page) => $page->where('profile.background_video.id', $video->id)->where('profile.background_video.title', 'Неон'));

        $owner->forceFill(['plus_until' => null])->save();
        $this->actingAs($guest)->get('/'.$owner->username)
            ->assertInertia(fn ($page) => $page->where('profile.background_video', null));
    }
}
