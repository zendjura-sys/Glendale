<?php

namespace Tests\Feature;

use App\Models\Family;
use App\Models\GtaServer;
use App\Models\Tournament;
use App\Models\TournamentMatch;
use App\Models\TournamentSubmission;
use App\Models\User;
use App\Notifications\TournamentNotice;
use App\Services\Families\FamilyService;
use App\Services\Servers\Tournaments;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class TournamentsTest extends TestCase
{
    use RefreshDatabase;

    private function server(?User $owner = null): GtaServer
    {
        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $server->forceFill(['owner_id' => $owner?->id])->save();

        return $server;
    }

    private function bracket(GtaServer $server, User $owner, int $size = 8): Tournament
    {
        $this->actingAs($owner)->post("/servers/{$server->slug}/tournaments", [
            'title' => 'Кубок Quant', 'kind' => 'bracket', 'size' => $size, 'starts_at' => now()->addDay()->toIso8601String(),
        ])->assertRedirect();

        return Tournament::query()->latest('id')->firstOrFail();
    }

    public function test_only_server_owner_or_staff_hosts_tournaments(): void
    {
        $owner = User::factory()->create();
        $server = $this->server($owner);
        $this->actingAs(User::factory()->create())->post("/servers/{$server->slug}/tournaments", [
            'title' => 'Чужий', 'kind' => 'bracket', 'size' => 8, 'starts_at' => now()->addDay()->toIso8601String(),
        ])->assertForbidden();

        $tournament = $this->bracket($server, $owner);
        $this->assertSame($owner->id, $tournament->user_id);
        $this->actingAs($owner)->get("/servers/{$server->slug}")->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('tournaments.can_host', true)->where('tournaments.list.0.title', 'Кубок Quant'));
    }

    public function test_bracket_with_byes_runs_to_a_winner(): void
    {
        Notification::fake();
        $owner = User::factory()->create();
        $tournament = $this->bracket($this->server($owner), $owner);
        $players = User::factory()->count(5)->create();
        foreach ($players as $player) {
            $this->actingAs($player)->post("/tournaments/{$tournament->id}/join")->assertRedirect();
        }
        $this->actingAs($players[0])->post("/tournaments/{$tournament->id}/join")->assertStatus(422);
        $this->actingAs($players[0])->post("/tournaments/{$tournament->id}/start")->assertForbidden();
        $this->actingAs($owner)->post("/tournaments/{$tournament->id}/start")->assertRedirect();
        Notification::assertSentTo($players[0], TournamentNotice::class);

        // 5 учасників → сітка на 8: 3 раунди, троє проходять перший раунд без суперника.
        $this->assertSame(7, TournamentMatch::query()->where('tournament_id', $tournament->id)->count());
        $this->assertSame(3, TournamentMatch::query()->where('tournament_id', $tournament->id)->where('round', 1)->whereNotNull('winner_entry_id')->count());

        while ($match = TournamentMatch::query()->where('tournament_id', $tournament->id)->whereNull('winner_entry_id')
            ->whereNotNull('a_entry_id')->whereNotNull('b_entry_id')->orderBy('round')->first()) {
            $this->actingAs($owner)->post("/tournaments/{$tournament->id}/matches/{$match->id}", ['winner_id' => $match->a_entry_id, 'score' => '2:1'])->assertRedirect();
        }

        $this->assertSame(Tournament::FINISHED, $tournament->fresh()->status);
        $this->actingAs($players[1])->get("/tournaments/{$tournament->id}")->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('tournaments/show')->has('rounds', 3)->whereNot('winner', null));

        // Результат зіграного раунду не змінити, коли наступний уже зіграно.
        $first = TournamentMatch::query()->where('tournament_id', $tournament->id)->where('round', 1)->whereNotNull('b_entry_id')->whereNotNull('a_entry_id')->firstOrFail();
        $this->actingAs($owner)->post("/tournaments/{$tournament->id}/matches/{$first->id}", ['winner_id' => $first->b_entry_id])->assertStatus(422);
    }

    public function test_family_entry_is_for_family_leaders_of_this_server(): void
    {
        $owner = User::factory()->create();
        $server = $this->server($owner);
        $leader = User::factory()->create();
        $family = app(FamilyService::class)->create($leader, ['server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL', 'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001']);
        $family->update(['status' => Family::STATUS_VERIFIED]);

        $this->actingAs($owner)->post("/servers/{$server->slug}/tournaments", [
            'title' => 'Кубок сімей', 'kind' => 'bracket', 'entry' => 'family', 'size' => 4, 'starts_at' => now()->addDay()->toIso8601String(),
        ]);
        $tournament = Tournament::query()->latest('id')->firstOrFail();

        $this->actingAs(User::factory()->create())->post("/tournaments/{$tournament->id}/join", ['family_id' => $family->id])->assertStatus(422);
        $this->actingAs($leader)->get("/tournaments/{$tournament->id}")
            ->assertInertia(fn (AssertableInertia $page) => $page->where('me.families.0.id', $family->id));
        $this->actingAs($leader)->post("/tournaments/{$tournament->id}/join", ['family_id' => $family->id])->assertRedirect();
        $this->assertDatabaseHas('tournament_entries', ['tournament_id' => $tournament->id, 'family_id' => $family->id]);
    }

    public function test_challenge_scores_need_approval_and_close_on_schedule(): void
    {
        Storage::fake('public');
        Notification::fake();
        $owner = User::factory()->create();
        $server = $this->server($owner);
        $this->actingAs($owner)->post("/servers/{$server->slug}/tournaments", [
            'title' => 'Найшвидше коло', 'kind' => 'challenge', 'metric' => 'Час, с', 'lower_is_better' => true,
            'starts_at' => now()->toIso8601String(), 'ends_at' => now()->addDays(3)->toIso8601String(),
        ])->assertRedirect();
        $tournament = Tournament::query()->latest('id')->firstOrFail();
        $this->assertSame(1, app(Tournaments::class)->tick());

        [$a, $b] = User::factory()->count(2)->create();
        $this->actingAs($a)->post("/tournaments/{$tournament->id}/submissions", ['value' => 72.5, 'proof' => UploadedFile::fake()->image('lap.png')])->assertRedirect();
        $this->actingAs($b)->post("/tournaments/{$tournament->id}/submissions", ['value' => 65])->assertRedirect();
        $this->actingAs($a)->post("/tournaments/{$tournament->id}/submissions", ['value' => 61])->assertRedirect();

        // До перевірки таблиця порожня.
        $this->assertSame([], app(Tournaments::class)->leaderboard($tournament));
        $this->actingAs($a)->post("/tournaments/{$tournament->id}/submissions/".TournamentSubmission::query()->value('id'), ['approve' => true])->assertForbidden();

        foreach (TournamentSubmission::query()->get() as $submission) {
            $this->actingAs($owner)->post("/tournaments/{$tournament->id}/submissions/{$submission->id}", ['approve' => (float) $submission->value !== 61.0])->assertRedirect();
        }
        Notification::assertSentTo($a, TournamentNotice::class);

        $board = app(Tournaments::class)->leaderboard($tournament);
        $this->assertSame([65.0, 72.5], array_column($board, 'value'));
        $this->assertSame($b->name, $board[0]['entry']['name']);

        $this->travel(4)->days();
        app(Tournaments::class)->tick();
        $this->assertSame(Tournament::FINISHED, $tournament->fresh()->status);
        $this->actingAs($a)->post("/tournaments/{$tournament->id}/submissions", ['value' => 50])->assertStatus(422);
    }

    public function test_disabled_plugin_hides_tournaments(): void
    {
        $owner = User::factory()->create();
        $tournament = $this->bracket($this->server($owner), $owner);
        app(Plugins::class)->set('server_tournaments', false);
        $this->actingAs($owner)->get("/tournaments/{$tournament->id}")->assertNotFound();
        $this->actingAs($owner)->get('/servers/quant-rp')->assertInertia(fn (AssertableInertia $page) => $page->where('tournaments', null));
    }
}
