<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\QuestClaim;
use App\Models\User;
use App\Services\Achievements;
use App\Services\Quests\DailyQuests;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DailyQuestsTest extends TestCase
{
    use RefreshDatabase;

    public function test_progress_counts_todays_activity(): void
    {
        $user = User::factory()->create();
        $quests = app(DailyQuests::class);
        $this->assertSame(0, $quests->progress($user, 'post'));
        Post::factory()->count(2)->create(['author_id' => $user->id]);
        Post::factory()->create(['author_id' => $user->id, 'created_at' => now()->subDays(2)]);
        $this->assertSame(2, $quests->progress($user, 'post'));

        // Три завдання на день, однакові протягом дня.
        $picks = $quests->picks($user);
        $this->assertCount(3, $picks);
        $this->assertSame($picks, $quests->picks($user));
    }

    public function test_claiming_rewards_xp_and_season_points(): void
    {
        $this->withoutVite();
        [$user, $other] = User::factory()->count(2)->create();
        // Завдання «виконані» — перевіряємо нагороди, а не підрахунок.
        $this->app->instance(DailyQuests::class, new class(app(ModuleManager::class)) extends DailyQuests
        {
            public function progress(User $user, string $key): int
            {
                return $user->email === 'busy@example.com' ? 0 : 99;
            }
        });
        $quests = app(DailyQuests::class);
        $picks = $quests->picks($user);
        $before = app(Achievements::class)->for($user)['xp'];

        $this->actingAs($user)->post(route('quests.claim', 'nonexistent'))->assertSessionHasErrors('quest');
        $this->actingAs($user)->post(route('quests.claim', $picks[0]))->assertRedirect();
        $this->actingAs($user)->post(route('quests.claim', $picks[0]))->assertSessionHasErrors('quest');
        $this->actingAs($user)->post(route('quests.claim', $picks[1]))->assertRedirect();
        $xp = DailyQuests::POOL[$picks[0]]['xp'] + DailyQuests::POOL[$picks[1]]['xp'];
        $this->assertSame(2, QuestClaim::query()->count());
        $this->assertSame($before + $xp, app(Achievements::class)->for($user)['xp']);

        $busy = User::factory()->create(['email' => 'busy@example.com']);
        $this->actingAs($busy)->post(route('quests.claim', $quests->picks($busy)[0]))->assertSessionHasErrors('quest');

        $this->actingAs($other)->post(route('quests.claim', $quests->picks($other)[0]))->assertRedirect();
        $this->actingAs($other)->get(route('quests.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('quests/index')
                ->has('quests', 3)
                ->where('season.top.0.user.id', $user->id)
                ->where('season.top.0.points', $xp)
                ->where('season.me.place', 2));
    }
}
