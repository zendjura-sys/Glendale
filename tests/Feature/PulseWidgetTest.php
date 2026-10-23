<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PulseWidgetTest extends TestCase
{
    use RefreshDatabase;

    public function test_pulse_shows_friends_playing_and_counters(): void
    {
        [$me, $friend, $away] = User::factory()->count(3)->create();
        foreach ([$friend, $away] as $other) {
            app(FriendshipService::class)->request($me, $other);
            app(FriendshipService::class)->accept($other, $me);
        }
        $friend->forceFill(['last_seen_at' => now(), 'playing_kind' => 'game', 'playing_label' => 'GTA V', 'playing_until' => now()->addHour()])->save();
        $away->forceFill(['last_seen_at' => now()->subHour()])->save();

        $this->withToken(app(ApiTokens::class)->issue($me, 'android'))->getJson('/api/v1/me/pulse-widget')->assertOk()
            ->assertJsonPath('friends_online', 1)
            ->assertJsonPath('playing.0.label', 'GTA V')
            ->assertJsonStructure(['name', 'messages', 'notifications', 'friend_requests', 'quests' => ['done', 'total'], 'season' => ['level', 'max']]);
    }
}
