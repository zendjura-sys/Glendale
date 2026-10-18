<?php

namespace Tests\Feature;

use App\Models\Follow;
use App\Models\Game;
use App\Models\GameEvent;
use App\Models\Post;
use App\Models\User;
use App\Services\Presence\PlayingStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardsFollowStartTest extends TestCase
{
    use RefreshDatabase;

    public function test_post_card_follow_alert_and_start_picks(): void
    {
        [$player, $friend, $stranger] = User::factory()->count(3)->create();
        $this->actingAs($player)->post(route('friends.store', $friend));
        $this->actingAs($friend)->post(route('friends.accept', $player));

        $game = Game::query()->create([
            'slug' => 'nova-drift',
            'name' => 'Nova Drift',
            'letter' => 'N',
            'category' => 'pc',
            'is_published' => true,
        ]);
        $event = GameEvent::query()->create([
            'title' => 'Nova Night',
            'type' => 'event',
            'starts_at' => now()->addDay(),
            'source' => 'manual',
        ]);

        $this->actingAs($player)->post(route('posts.store'), [
            'body' => 'Сьогодні',
            'visibility' => 'public',
            'card' => ['kind' => 'game', 'id' => $game->id],
        ])->assertRedirect();
        $this->actingAs($player)->post(route('posts.store'), [
            'visibility' => 'public',
            'card' => ['kind' => 'game_event', 'id' => $event->id],
        ])->assertRedirect();

        $cards = Post::query()->latest('id')->pluck('card');
        $this->assertTrue($cards->contains(fn ($card) => ($card['title'] ?? null) === 'Nova Drift' && $card['href'] === '/games/nova-drift'));
        $this->assertTrue($cards->contains(fn ($card) => ($card['hint'] ?? null) === 'Подія' && $card['title'] === 'Nova Night'));

        Follow::query()->create(['user_id' => $friend->id, 'kind' => 'game', 'subject_id' => $game->id]);
        Follow::query()->create(['user_id' => $stranger->id, 'kind' => 'game', 'subject_id' => $game->id]);
        app(PlayingStatus::class)->manual($player, 'game', $game->id, null, 1);

        $this->assertTrue($friend->fresh()->notifications->contains(fn ($note) => ($note->data['kind'] ?? null) === 'friend_playing'));
        $this->assertFalse($stranger->fresh()->notifications->contains(fn ($note) => ($note->data['kind'] ?? null) === 'friend_playing'));

        $newbie = User::factory()->create();
        $newbie->mergePref(['onboarded' => false]);
        $this->withoutVite()->actingAs($newbie)->get(route('feed'))->assertRedirect(route('start'));
        $this->actingAs($newbie)->post(route('start.store'), ['games' => [$game->id], 'servers' => [999]])->assertRedirect(route('feed'));
        $this->assertTrue($newbie->fresh()->pref('onboarded'));
        $this->assertDatabaseHas('follows', ['user_id' => $newbie->id, 'kind' => 'game', 'subject_id' => $game->id]);
        $this->assertDatabaseMissing('follows', ['user_id' => $newbie->id, 'subject_id' => 999]);
    }
}
