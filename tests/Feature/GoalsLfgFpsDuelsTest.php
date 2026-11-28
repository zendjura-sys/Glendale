<?php

namespace Tests\Feature;

use App\Models\Duel;
use App\Models\Game;
use App\Models\PartyPost;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GoalsLfgFpsDuelsTest extends TestCase
{
    use RefreshDatabase;

    private function game(): Game
    {
        return Game::query()->create(['slug' => 'cs2', 'name' => 'CS2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
    }

    public function test_goals_with_progress(): void
    {
        $this->game();
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/games/cs2/goals', ['title' => '100 перемог', 'target' => 100])->assertOk()->assertJsonPath('goals.0.target', 100);
        $id = $this->actingAs($user)->getJson('/games/cs2/goals')->json('goals.0.id');
        $this->actingAs($user)->patchJson("/games/cs2/goals/{$id}", ['progress' => 150])->assertJsonPath('goals.0.progress', 100)->assertJsonPath('goals.0.done', true);
        $this->actingAs(User::factory()->create())->patchJson("/games/cs2/goals/{$id}", ['progress' => 1])->assertNotFound();
    }

    public function test_lfg_filters_and_age_limit(): void
    {
        $host = User::factory()->create();
        $this->actingAs($host)->post('/party', ['title' => 'Ранкед 18+', 'slots' => 5, 'mic' => true, 'language' => 'uk', 'age_min' => 18, 'style' => 'tryhard'])->assertSessionHasNoErrors();
        $this->actingAs($host)->post('/party', ['title' => 'Просто пограти', 'slots' => 4])->assertSessionHasNoErrors();
        $ranked = PartyPost::query()->where('title', 'Ранкед 18+')->firstOrFail();

        $adult = User::factory()->create(['birthday' => now()->subYears(25)]);
        $this->actingAs($adult)->get('/party?mic=1&language=uk&style=tryhard')->assertInertia(fn (Assert $page) => $page
            ->has('parties', 1)->where('parties.0.mic', true)->where('parties.0.age_min', 18));

        $teen = User::factory()->create(['birthday' => now()->subYears(15)]);
        $this->actingAs($teen)->get('/party')->assertInertia(fn (Assert $page) => $page->has('parties', 1)->where('parties.0.title', 'Просто пограти'));
        $this->actingAs($teen)->post("/party/{$ranked->id}/join")->assertStatus(422);
    }

    public function test_fps_reports_median_by_gpu(): void
    {
        $this->game();
        foreach ([[120], [140], [100]] as $i => [$fps]) {
            $this->actingAs(User::factory()->create())->postJson('/games/cs2/fps', ['gpu' => 'RTX 4060', 'resolution' => '1080p', 'preset' => 'high', 'fps' => $fps])->assertOk();
        }
        $this->actingAs(User::factory()->create())->postJson('/games/cs2/fps', ['gpu' => 'GTX 1650', 'resolution' => '1080p', 'preset' => 'high', 'fps' => 60]);
        $this->getJson('/games/cs2/fps?resolution=1080p&preset=high')->assertOk()
            ->assertJsonPath('rows.0.gpu', 'RTX 4060')->assertJsonPath('rows.0.fps', 120)->assertJsonPath('rows.0.reports', 3)
            ->assertJsonPath('rows.1.fps', 60);
    }

    public function test_duel_flow_needs_both_to_agree(): void
    {
        $this->game();
        $a = User::factory()->create();
        $b = User::factory()->create(['username' => 'rival']);
        $this->actingAs($a)->post('/duels', ['username' => '@rival', 'game' => 'cs2', 'terms' => '1v1 на Mirage до 10'])->assertSessionHasNoErrors();
        $duel = Duel::query()->firstOrFail();
        $this->assertSame(1, $b->notifications()->count());

        $this->actingAs($a)->post("/duels/{$duel->id}", ['action' => 'accept'])->assertStatus(422);
        $this->actingAs($b)->post("/duels/{$duel->id}", ['action' => 'accept'])->assertRedirect();
        $this->actingAs($a)->post("/duels/{$duel->id}", ['action' => 'report', 'winner' => $a->id]);
        $this->actingAs($b)->post("/duels/{$duel->id}", ['action' => 'report', 'winner' => $b->id]);
        $this->assertSame('disputed', $duel->fresh()->status);
        $this->actingAs($b)->post("/duels/{$duel->id}", ['action' => 'report', 'winner' => $a->id]);
        $this->assertSame('finished', $duel->fresh()->status);
        $this->assertSame($a->id, $duel->fresh()->winner_id);

        $this->actingAs($a)->get('/duels')->assertInertia(fn (Assert $page) => $page->where('stats.wins', 1)->where('stats.losses', 0));
        $this->actingAs(User::factory()->create())->post("/duels/{$duel->id}", ['action' => 'cancel'])->assertForbidden();
    }
}
