<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\PartyPost;
use App\Models\TeammateProfile;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\PartyInvite;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class TeammatesTest extends TestCase
{
    use RefreshDatabase;

    private function profile(User $user, array $data): void
    {
        $this->actingAs($user)->put('/party/match/profile', $data)->assertRedirect();
    }

    public function test_matches_rank_by_shared_games_and_explain_why(): void
    {
        Game::query()->create(['slug' => 'cs2', 'name' => 'Counter-Strike 2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
        Game::query()->create(['slug' => 'gta-v', 'name' => 'GTA V', 'letter' => 'G', 'category' => 'pc', 'is_published' => true]);
        [$me, $best, $ok, $foreign, $hidden, $blocked] = User::factory()->count(6)->create();

        $this->profile($me, ['games' => ['cs2'], 'languages' => ['uk'], 'times' => ['evening'], 'skill' => 'mid', 'mic' => true]);
        $this->profile($best, ['games' => ['cs2'], 'languages' => ['uk', 'en'], 'times' => ['evening', 'night'], 'skill' => 'mid', 'mic' => true]);
        $this->profile($ok, ['games' => ['gta-v'], 'languages' => ['uk'], 'skill' => 'pro']);
        $this->profile($foreign, ['games' => ['cs2'], 'languages' => ['de'], 'skill' => 'mid']);
        $this->profile($hidden, ['games' => ['cs2'], 'languages' => ['uk'], 'visible' => false]);
        $this->profile($blocked, ['games' => ['cs2'], 'languages' => ['uk']]);
        UserBlock::query()->create(['user_id' => $blocked->id, 'blocked_id' => $me->id]);
        $this->actingAs($ok)->post('/party/match/looking', ['on' => true])->assertRedirect();

        $this->actingAs($me)->get('/party/match')->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('party/match')
            ->where('profile.games.0.slug', 'cs2')
            ->has('matches', 2)
            ->where('matches.0.user.id', $best->id)
            ->where('matches.0.reasons.0', ['type' => 'game', 'name' => 'Counter-Strike 2'])
            ->where('matches.1.user.id', $ok->id)
            ->where('matches.1.looking', true));

        // Фільтр за грою.
        $this->actingAs($me)->get('/party/match?game=gta-v')->assertInertia(fn (AssertableInertia $page) => $page->has('matches', 1)->where('matches.0.user.id', $ok->id));
    }

    public function test_looking_needs_a_profile_and_expires(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->post('/party/match/looking', ['on' => true])->assertStatus(422);
        $this->profile($user, ['languages' => ['uk']]);
        $this->actingAs($user)->post('/party/match/looking', ['on' => true]);
        $this->assertTrue(TeammateProfile::query()->firstOrFail()->isLooking());
        $this->travel(3)->hours();
        $this->assertFalse(TeammateProfile::query()->firstOrFail()->isLooking());
    }

    public function test_host_sees_suggestions_and_invites_once(): void
    {
        Notification::fake();
        $game = Game::query()->create(['slug' => 'cs2', 'name' => 'Counter-Strike 2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
        [$host, $player, $stranger] = User::factory()->count(3)->create();
        $this->profile($host, ['games' => ['cs2']]);
        $this->profile($player, ['games' => ['cs2']]);
        $party = PartyPost::query()->create(['user_id' => $host->id, 'title' => 'Ранкед', 'slots' => 5, 'game_id' => $game->id, 'expires_at' => now()->addHours(3)]);

        $this->actingAs($host)->get("/party/{$party->id}")->assertInertia(fn (AssertableInertia $page) => $page->where('suggestions.0.user.id', $player->id));
        $this->actingAs($player)->get("/party/{$party->id}")->assertInertia(fn (AssertableInertia $page) => $page->where('suggestions', []));

        $this->actingAs($stranger)->post("/party/{$party->id}/invite", ['user_id' => $player->id])->assertForbidden();
        $this->actingAs($host)->post("/party/{$party->id}/invite", ['user_id' => $stranger->id])->assertStatus(422);
        $this->actingAs($host)->post("/party/{$party->id}/invite", ['user_id' => $player->id])->assertRedirect();
        Notification::assertSentTo($player, PartyInvite::class);
        $this->actingAs($host)->post("/party/{$party->id}/invite", ['user_id' => $player->id])->assertStatus(422);
    }
}
