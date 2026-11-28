<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Post;
use App\Models\User;
use App\Services\Achievements;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/** №275: свіжі досягнення друзів у лобі; старі (до обліку) — тихо, без стрічки. */
class FriendAchievementsTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_friend_achievements_show_in_lobby_now(): void
    {
        [$viewer, $newbie, $veteran, $stranger] = User::factory()->count(4)->create();
        foreach ([$newbie, $veteran] as $friend) {
            Friendship::query()->create(['requester_id' => $viewer->id, 'addressee_id' => $friend->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        }
        $achievements = app(Achievements::class);

        // Ветеран мав запис ще до обліку — «Перший пост» записано тихо.
        Post::factory()->for($veteran, 'author')->create(['wall_type' => 'user', 'wall_id' => $veteran->id, 'visibility' => 'public']);
        $achievements->for($veteran);
        // Новачок: перший облік без бейджів, потім перший запис — це вже нове досягнення.
        $achievements->for($newbie);
        Post::factory()->for($newbie, 'author')->create(['wall_type' => 'user', 'wall_id' => $newbie->id, 'visibility' => 'public']);
        Cache::forget("achievements.{$newbie->id}");
        $achievements->for($newbie);
        // Не друг — не показуємо.
        Post::factory()->for($stranger, 'author')->create(['wall_type' => 'user', 'wall_id' => $stranger->id, 'visibility' => 'public']);
        $achievements->for($stranger);
        Cache::forget("achievements.{$stranger->id}");
        $achievements->for($stranger);

        $items = $this->actingAs($viewer)->getJson('/me/now')->assertOk()->json('achievements');
        $this->assertSame([[$newbie->id, 'first_post']], array_map(fn (array $i) => [$i['user']['id'], $i['key']], $items));
        $this->assertSame('Перший пост', $items[0]['title']);
    }
}
