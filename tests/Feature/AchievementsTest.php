<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\Achievements;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AchievementsTest extends TestCase
{
    use RefreshDatabase;

    public function test_activity_gives_experience_level_and_badges_in_profile(): void
    {
        $user = User::factory()->create(['created_at' => now()->subDays(40)]);
        $friend = User::factory()->create();
        $friendships = app(FriendshipService::class);
        $friendships->request($user, $friend);
        $friendships->accept($friend, $user);
        Post::factory()->count(3)->create(['author_id' => $user->id]);

        $data = app(Achievements::class)->for($user);
        $badges = collect($data['badges'])->keyBy('key');

        // 3 пости × 10 + 1 друг × 5 + 40 днів × 1 = 75 досвіду → рівень 2.
        $this->assertSame(75, $data['xp']);
        $this->assertSame(2, $data['level']);
        $this->assertSame(50, $data['level_xp']);
        $this->assertSame(200, $data['next_xp']);
        $this->assertTrue($badges['first_post']['earned']);
        $this->assertTrue($badges['month']['earned']);
        $this->assertFalse($badges['year']['earned']);
        $this->assertSame(40, $badges['year']['progress']);
        $this->assertFalse($badges['friends_10']['earned']);

        Cache::flush();
        $this->actingAs($friend)->get(route('profile.show', $user))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('achievements.level', 2)
                ->where('achievements.title', 'Новачок'));
    }

    public function test_levels_grow_slower_with_each_step(): void
    {
        $service = app(Achievements::class);
        $this->assertSame(1, $service->level(0));
        $this->assertSame(1, $service->level(49));
        $this->assertSame(2, $service->level(50));
        $this->assertSame(3, $service->level(200));
        $this->assertSame(11, $service->level(5000));
    }
}
