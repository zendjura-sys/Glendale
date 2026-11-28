<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\QuestClaim;
use App\Models\User;
use App\Services\Quests\DailyQuests;
use App\Services\Quests\WeeklyChallenges;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** №274: челенджі тижня — прогрес із понеділка, нагорода в сезон, однакові для всіх. */
class WeeklyChallengesTest extends TestCase
{
    use RefreshDatabase;

    public function test_progress_counts_from_monday_and_picks_are_shared(): void
    {
        // Середа: запис у неділю минулого тижня не рахується, у понеділок — рахується.
        $this->travelTo(Carbon::parse('2026-11-18 12:00', 'Europe/Kyiv'));
        $user = User::factory()->create();
        Post::factory()->create(['author_id' => $user->id, 'created_at' => Carbon::parse('2026-11-15 20:00', 'Europe/Kyiv')]);
        Post::factory()->count(2)->create(['author_id' => $user->id, 'created_at' => Carbon::parse('2026-11-16 09:00', 'Europe/Kyiv')]);
        $weekly = app(WeeklyChallenges::class);
        $this->assertSame('2026-11-16', $weekly->weekStart()->toDateString());
        $this->assertSame(2, app(DailyQuests::class)->progress($user, 'post', $weekly->weekStart()));
        $this->assertCount(WeeklyChallenges::PER_WEEK, $weekly->picks());
        $this->assertSame($weekly->picks(), app(WeeklyChallenges::class)->picks());
    }

    public function test_claim_once_into_season_and_page_shows_challenges(): void
    {
        $this->withoutVite();
        // Челенджі «виконані» — перевіряємо нагороду, а не підрахунок; busy@ — ще ні.
        $this->app->instance(DailyQuests::class, new class(app(ModuleManager::class)) extends DailyQuests
        {
            public function progress(User $user, string $key, ?Carbon $from = null): int
            {
                return $user->email === 'busy@example.com' ? 0 : 999;
            }
        });
        $user = User::factory()->create();
        $busy = User::factory()->create(['email' => 'busy@example.com']);
        $key = app(WeeklyChallenges::class)->picks()[0];

        $this->actingAs($busy)->post(route('quests.week.claim', $key))->assertSessionHasErrors('quest');
        $this->actingAs($user)->post(route('quests.week.claim', 'nonexistent'))->assertSessionHasErrors('quest');
        $this->actingAs($user)->post(route('quests.week.claim', $key))->assertRedirect()->assertSessionHasNoErrors();
        $this->actingAs($user)->post(route('quests.week.claim', $key))->assertSessionHasErrors('quest');
        $claim = QuestClaim::query()->sole();
        $this->assertSame('w:'.$key, $claim->quest);
        $this->assertSame(now('Europe/Kyiv')->format('Y-m'), $claim->season);
        $this->assertSame(WeeklyChallenges::POOL[$key]['xp'], (int) $claim->xp);

        $this->actingAs($user)->get('/quests')->assertInertia(fn (Assert $page) => $page
            ->has('weekly', WeeklyChallenges::PER_WEEK)
            ->where('weekly.0.claimed', true)
            ->where('weekly.0.finishers', 1));
    }
}
