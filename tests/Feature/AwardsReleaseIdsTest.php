<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameWishlist;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AwardsReleaseIdsTest extends TestCase
{
    use RefreshDatabase;

    private function game(string $slug, array $extra = []): Game
    {
        return Game::query()->create(['slug' => $slug, 'name' => strtoupper($slug), 'letter' => 'C', 'category' => 'pc', 'is_published' => true, ...$extra]);
    }

    public function test_voting_in_december_and_results_in_january(): void
    {
        $this->travelTo(CarbonImmutable::create(2026, 12, 10, 12, 0, 0, 'Europe/Kyiv'));
        $cs = $this->game('cs2', ['genres' => ['Шутер'], 'released' => '2023-09-27']);
        $fresh = $this->game('newgame', ['genres' => ['RPG'], 'released' => '2026-03-01']);
        $voter = User::factory()->create(['created_at' => now()->subMonth()]);
        $newbie = User::factory()->create();

        $this->actingAs($voter)->get('/games/awards')->assertInertia(fn (Assert $p) => $p->component('games/awards')->where('year', 2026)->where('phase', 'voting'));
        $this->actingAs($voter)->getJson('/games/awards/candidates?category=newcomer')->assertJsonCount(1, 'games')->assertJsonPath('games.0.slug', 'newgame');
        $this->actingAs($voter)->postJson('/games/awards/vote', ['category' => 'shooter', 'game' => 'newgame'])->assertStatus(422);
        $this->actingAs($voter)->postJson('/games/awards/vote', ['category' => 'shooter', 'game' => 'cs2'])->assertOk();
        $this->actingAs($voter)->postJson('/games/awards/vote', ['category' => 'goty', 'game' => 'cs2'])->assertOk();
        $this->actingAs($voter)->postJson('/games/awards/vote', ['category' => 'goty', 'game' => 'newgame'])->assertOk();
        $this->actingAs($newbie)->postJson('/games/awards/vote', ['category' => 'goty', 'game' => 'cs2'])->assertStatus(422);
        $this->assertSame(2, DB::table('goty_votes')->count());
        $this->assertSame($fresh->id, (int) DB::table('goty_votes')->where('category', 'goty')->value('game_id'));

        $this->travelTo(CarbonImmutable::create(2027, 1, 2, 12, 0, 0, 'Europe/Kyiv'));
        $this->actingAs($voter)->postJson('/games/awards/vote', ['category' => 'goty', 'game' => 'cs2'])->assertStatus(422);
        $this->actingAs($voter)->get('/games/awards')->assertInertia(fn (Assert $p) => $p->where('year', 2026)->where('phase', 'results')
            ->where('categories.0.results.top.0.slug', 'newgame')->where('categories.0.results.top.0.percent', 100)
            ->where('archive', [2026])->where('next_year', 2027));
        $this->assertSame($cs->id, (int) DB::table('goty_votes')->where('category', 'shooter')->value('game_id'));
    }

    public function test_release_day_alert_is_sent_once(): void
    {
        $this->travelTo(CarbonImmutable::create(2026, 11, 20, 12, 0, 0, 'Europe/Kyiv'));
        $user = User::factory()->create();
        $out = $this->game('outnow', ['released' => '2026-11-20']);
        $later = $this->game('later', ['released' => '2027-02-01']);
        GameWishlist::query()->create(['user_id' => $user->id, 'game_id' => $out->id]);
        GameWishlist::query()->create(['user_id' => $user->id, 'game_id' => $later->id]);

        $this->artisan('games:release-alerts')->assertOk();
        $this->artisan('games:release-alerts')->assertOk();
        $this->assertSame(1, $user->notifications()->count());
        $this->assertSame('game_release', $user->notifications()->first()?->data['kind']);
    }

    public function test_gamer_ids_saved_and_shown_with_validation(): void
    {
        $user = User::factory()->create();
        $viewer = User::factory()->create();
        $this->actingAs($user)->put('/me/playing/consoles', ['riot' => 'безтегу'])->assertSessionHasErrors('riot');
        $this->actingAs($user)->put('/me/playing/consoles', ['riot' => 'Shadow#EUW', 'battlenet' => 'Hero#21345', 'playstation' => 'psn_hero'])->assertSessionHasNoErrors();
        // Старий клієнт шле лише Xbox і PlayStation — решта не стирається.
        $this->actingAs($user)->put('/me/playing/consoles', ['xbox' => 'Hero Tag', 'playstation' => 'psn_hero'])->assertSessionHasNoErrors();
        $this->actingAs($viewer)->get('/'.$user->username)->assertInertia(fn (Assert $p) => $p
            ->where('profile.platforms.ids.0.key', 'playstation')
            ->where('profile.platforms.ids.1.value', 'Hero Tag')
            ->where('profile.platforms.ids.2.value', 'Shadow#EUW')
            ->where('profile.platforms.ids.3.key', 'battlenet'));
    }
}
