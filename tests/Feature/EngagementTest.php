<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use App\Services\Engagement\Streaks;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class EngagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_streak_grows_daily_and_resets_after_gap(): void
    {
        $user = User::factory()->create();
        $streaks = app(Streaks::class);
        $this->travelTo(CarbonImmutable::parse('2026-10-28 12:00', 'Europe/Kyiv'));
        $streaks->touch($user);
        $streaks->touch($user);
        $this->assertSame(1, $user->streak_days);
        $this->travelTo(CarbonImmutable::parse('2026-10-29 10:00', 'Europe/Kyiv'));
        $streaks->touch($user);
        $this->travelTo(CarbonImmutable::parse('2026-10-30 23:30', 'Europe/Kyiv'));
        $streaks->touch($user);
        $this->assertSame(3, $user->streak_days);
        $this->assertSame(3, $streaks->state($user)['milestone']);
        // Пропустили день — серія з нуля, рекорд лишається.
        $this->travelTo(CarbonImmutable::parse('2026-11-01 09:00', 'Europe/Kyiv'));
        $this->assertSame(0, $streaks->state($user)['days']);
        $streaks->touch($user);
        $this->assertSame(1, $user->streak_days);
        $this->assertSame(3, $user->streak_best);

        // Запит на сайт теж рахує день.
        $this->travelTo(CarbonImmutable::parse('2026-11-02 09:00', 'Europe/Kyiv'));
        $this->actingAs($user->fresh())->get('/feed')->assertInertia(fn (Assert $p) => $p->where('engagement.streak.days', 2));
    }

    public function test_memories_show_own_posts_from_this_day_in_past_years(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-31 12:00', 'Europe/Kyiv'));
        $user = User::factory()->create();
        $old = Post::factory()->create(['author_id' => $user->id, 'wall_id' => $user->id, 'body' => 'Рік тому', 'created_at' => now()->subYear()]);
        Post::factory()->create(['author_id' => $user->id, 'wall_id' => $user->id, 'body' => 'Сьогодні', 'created_at' => now()]);
        Post::factory()->create(['author_id' => $user->id, 'wall_id' => $user->id, 'body' => 'Інший день', 'created_at' => now()->subYear()->subDays(3)]);
        Post::factory()->create(['body' => 'Чужий', 'created_at' => now()->subYear()]);

        $this->actingAs($user)->get('/memories')->assertInertia(fn (Assert $p) => $p
            ->component('memories/index')->has('posts', 1)->where('posts.0.id', $old->id));
        $this->actingAs($user)->get('/feed')->assertInertia(fn (Assert $p) => $p->where('engagement.memories', 1));
    }

    public function test_players_map_counts_countries_only(): void
    {
        User::factory()->count(3)->create(['country' => 'UA']);
        User::factory()->create(['country' => 'PL']);
        User::factory()->create(['country' => 'UA', 'banned_at' => now()]);
        $this->actingAs(User::factory()->create())->get('/map')->assertInertia(fn (Assert $p) => $p
            ->component('map/index')
            ->where('countries.0.code', 'UA')->where('countries.0.count', 3)
            ->where('countries.1.code', 'PL')->where('countries.1.count', 1)
            ->missing('countries.0.users'));
    }

    public function test_event_frame_only_during_season_and_when_enabled(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-30 12:00', 'Europe/Kyiv'));
        $user = User::factory()->create();
        $this->assertNull($user->toCard()['event_frame']);
        $this->actingAs($user)->putJson('/settings/event-frame', ['on' => true])->assertOk()->assertJsonPath('event_frame', 'halloween');
        $this->assertSame('halloween', $user->fresh()->toCard()['event_frame']);
        $this->actingAs($user)->get('/feed')->assertInertia(fn (Assert $p) => $p->where('engagement.frame', ['season' => 'halloween', 'on' => true]));
    }
}
