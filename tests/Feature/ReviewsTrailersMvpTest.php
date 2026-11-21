<?php

namespace Tests\Feature;

use App\Models\Clan;
use App\Models\ClanMember;
use App\Models\Game;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ReviewsTrailersMvpTest extends TestCase
{
    use RefreshDatabase;

    private function game(string $slug = 'cs2', array $details = []): Game
    {
        return Game::query()->create(['slug' => $slug, 'name' => strtoupper($slug), 'letter' => 'C', 'category' => 'pc', 'is_published' => true, 'details' => $details]);
    }

    public function test_reviews_upsert_score_and_helpful_votes(): void
    {
        $game = $this->game();
        $author = User::factory()->create();
        $reader = User::factory()->create();
        $this->actingAs($author)->postJson("/games/{$game->slug}/reviews", ['body' => 'Коротко', 'score' => 9, 'recommended' => true])->assertStatus(422);
        $this->actingAs($author)->postJson("/games/{$game->slug}/reviews", ['body' => 'Найкращий тактичний шутер, але новачкам важко.', 'score' => 9, 'recommended' => true, 'hours' => 1200])->assertOk();
        $this->actingAs($author)->postJson("/games/{$game->slug}/reviews", ['body' => 'Оновлюю огляд: після патчу стало краще.', 'score' => 10, 'recommended' => true])->assertOk();
        $this->assertSame(1, DB::table('game_reviews')->count());
        $this->assertSame(10, (int) DB::table('game_ratings')->where('user_id', $author->id)->value('score'));

        $review = DB::table('game_reviews')->value('id');
        $this->actingAs($author)->postJson("/games/reviews/{$review}/helpful")->assertStatus(422);
        $this->actingAs($reader)->postJson("/games/reviews/{$review}/helpful")->assertJsonPath('helpful', true)->assertJsonPath('helpful_count', 1);
        $this->actingAs($reader)->getJson("/games/{$game->slug}/reviews")->assertOk()
            ->assertJsonPath('summary.count', 1)->assertJsonPath('summary.recommended', 1)
            ->assertJsonPath('reviews.data.0.helpful', true)->assertJsonPath('mine', null);
        $this->actingAs($author)->deleteJson("/games/{$game->slug}/reviews")->assertOk();
        $this->assertSame(0, DB::table('game_reviews')->count());
    }

    public function test_trailers_list_only_games_with_videos(): void
    {
        $this->game('cs2', ['videos' => [['id' => 'abc123', 'name' => 'Трейлер']]]);
        $this->game('dota');
        $this->actingAs(User::factory()->create())->get('/games/trailers')->assertInertia(fn (Assert $p) => $p
            ->component('games/trailers')->has('games.data', 1)->where('games.data.0.videos.0.id', 'abc123'));
    }

    public function test_clan_player_of_the_month_votes(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-15 12:00', 'Europe/Kyiv'));
        $owner = User::factory()->create();
        $a = User::factory()->create();
        $b = User::factory()->create();
        $outsider = User::factory()->create();
        $clan = Clan::query()->create(['game_id' => $this->game()->id, 'slug' => 'navi', 'type' => 'clan', 'name' => 'NaVi', 'tag' => 'NAVI', 'owner_id' => $owner->id, 'features' => [], 'join_mode' => 'open']);
        foreach ([$owner, $a, $b] as $i => $u) {
            ClanMember::query()->create(['clan_id' => $clan->id, 'user_id' => $u->id, 'rank' => $i === 0 ? 5 : 1, 'status' => ClanMember::STATUS_ACTIVE, 'joined_at' => now()]);
        }
        $this->actingAs($a)->postJson("/clans/{$clan->slug}/mvp", ['user_id' => $a->id])->assertStatus(422);
        $this->actingAs($a)->post("/clans/{$clan->slug}/mvp", ['user_id' => $outsider->id])->assertForbidden();
        $this->actingAs($a)->post("/clans/{$clan->slug}/mvp", ['user_id' => $b->id])->assertRedirect();
        $this->actingAs($owner)->post("/clans/{$clan->slug}/mvp", ['user_id' => $b->id])->assertRedirect();
        $this->actingAs($owner)->get("/clans/{$clan->slug}")->assertInertia(fn (Assert $p) => $p
            ->where('mvp.leaders.0.user.id', $b->id)->where('mvp.leaders.0.votes', 2)->where('mvp.my_vote', $b->id)->where('mvp.winner', null));

        // Наступного місяця — переможець оголошений.
        $this->travelTo(CarbonImmutable::parse('2026-11-02 12:00', 'Europe/Kyiv'));
        $this->actingAs($a)->get("/clans/{$clan->slug}")->assertInertia(fn (Assert $p) => $p
            ->where('mvp.winner.user.id', $b->id)->where('mvp.winner.month', '2026-10')->where('mvp.leaders', []));
    }
}
