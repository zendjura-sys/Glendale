<?php

namespace Tests\Feature;

use App\Models\Clan;
use App\Models\ClanAlliance;
use App\Models\Game;
use App\Models\User;
use App\Services\Games\GameCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ClanDiplomacyTest extends TestCase
{
    use RefreshDatabase;

    private Game $game;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        app(GameCatalog::class)->seed();
        $this->game = Game::query()->where('slug', 'counter-strike-2')->sole();
    }

    public function test_closed_recruitment_blocks_join_and_leaders_can_ally_and_schedule_a_match(): void
    {
        $homeLeader = User::factory()->create();
        $home = $this->clan('Natus Vincere', 'navi', $homeLeader);
        $awayLeader = User::factory()->create();
        $away = $this->clan('Virtus Pro', 'vp', $awayLeader);
        $stranger = User::factory()->create();

        $this->actingAs($homeLeader)->post(route('clans.update', $home), ['is_recruiting' => false])->assertRedirect();
        $this->actingAs($stranger)->from(route('clans.show', $home))->post(route('clans.join', $home))->assertInvalid(['clan']);

        $this->actingAs($homeLeader)->post(route('clans.allies.store', $home), ['tag' => 'vp'])->assertRedirect();
        $alliance = ClanAlliance::query()->sole();
        $this->actingAs($awayLeader)->post(route('clans.allies.accept', [$away, $alliance]))->assertRedirect();

        $this->actingAs($homeLeader)->post(route('clans.matches.store', $home), [
            'tag' => 'vp',
            'starts_at' => now()->addDay()->toDateTimeString(),
            'note' => 'фінал',
        ])->assertRedirect();

        $this->actingAs($stranger)->get(route('clans.show', $home))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('allies.0.slug', $away->slug)
                ->where('matches.0.away', 'VP')
                ->where('matches.0.note', 'фінал'));
    }

    private function clan(string $name, string $tag, ?User $owner = null): Clan
    {
        $owner ??= User::factory()->create();
        $this->actingAs($owner)->post(route('clans.store'), [
            'type' => 'clan',
            'name' => $name,
            'tag' => $tag,
            'game_id' => $this->game->id,
            'features' => ['news', 'events'],
            'join_mode' => 'request',
        ])->assertRedirect();

        return Clan::query()->where('tag', strtoupper($tag))->firstOrFail();
    }
}
