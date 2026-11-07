<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameQuestion;
use App\Models\TierList;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TierListsQaMentorsTest extends TestCase
{
    use RefreshDatabase;

    private function game(): Game
    {
        return Game::query()->create(['slug' => 'valorant', 'name' => 'Valorant', 'letter' => 'V', 'category' => 'pc', 'is_published' => true]);
    }

    public function test_tier_list_is_created_shared_and_kept_private(): void
    {
        $game = $this->game();
        $author = User::factory()->create();
        $tiers = [
            ['label' => 'S', 'color' => 'rose', 'items' => ['Jett', ' Omen ', '']],
            ['label' => 'A', 'color' => 'amber', 'items' => ['Sage']],
        ];
        $this->actingAs($author)->post('/tierlists', ['title' => 'Агенти', 'game_id' => $game->id, 'is_public' => true, 'tiers' => [['label' => 'S', 'color' => 'neon', 'items' => []], ['label' => 'A', 'color' => 'rose', 'items' => []]]])->assertSessionHasErrors('tiers.0.color');
        $this->actingAs($author)->post('/tierlists', ['title' => 'Агенти', 'game_id' => $game->id, 'is_public' => true, 'tiers' => $tiers])->assertRedirect();

        $list = TierList::query()->firstOrFail();
        $this->assertSame(['Jett', 'Omen'], $list->tiers[0]['items']);

        $viewer = User::factory()->create();
        $this->actingAs($viewer)->get("/tierlists/{$list->id}")->assertInertia(fn (Assert $page) => $page->component('tierlists/show')->where('list.tiers.1.items.0', 'Sage')->where('own', false));
        $this->assertSame(1, $list->fresh()->views_count);
        $this->actingAs($viewer)->put("/tierlists/{$list->id}", ['title' => 'Злам', 'is_public' => true, 'tiers' => $tiers])->assertForbidden();

        $this->actingAs($viewer)->get('/tierlists?game=valorant')->assertInertia(fn (Assert $page) => $page->where('lists.data.0.title', 'Агенти'));

        $list->update(['is_public' => false]);
        $this->actingAs($viewer)->get("/tierlists/{$list->id}")->assertNotFound();
        $this->actingAs($author)->get("/tierlists/{$list->id}")->assertOk();
    }

    public function test_players_ask_answer_vote_and_mark_solved(): void
    {
        $game = $this->game();
        $asker = User::factory()->create();
        $helper = User::factory()->create();

        $this->actingAs($asker)->postJson('/games/valorant/questions', ['title' => 'Як знизити пінг у Valorant?'])->assertOk()->assertJsonPath('questions.0.own', true);
        $question = GameQuestion::query()->firstOrFail();

        $this->actingAs($helper)->postJson("/games/valorant/questions/{$question->id}/answers", ['body' => 'Оберіть сервер Франкфурт.'])->assertOk();
        $this->assertSame(1, $asker->notifications()->count());
        $answerId = $question->answers()->value('id');

        $this->actingAs($helper)->postJson("/games/valorant/answers/{$answerId}/vote")->assertStatus(422);
        $this->actingAs($asker)->postJson("/games/valorant/answers/{$answerId}/vote")->assertOk()->assertJsonPath('questions.0.answers.0.votes', 1);

        $this->actingAs($helper)->postJson("/games/valorant/questions/{$question->id}/solve", ['answer_id' => $answerId])->assertForbidden();
        $this->actingAs($asker)->postJson("/games/valorant/questions/{$question->id}/solve", ['answer_id' => $answerId])->assertOk()->assertJsonPath('questions.0.solved_answer_id', $answerId);

        // Гостям питання видно.
        $this->getJson('/games/valorant/questions')->assertOk()->assertJsonPath('questions.0.answers.0.body', 'Оберіть сервер Франкфурт.');
    }

    public function test_mentor_signup_needs_account_age(): void
    {
        $this->game();
        $newbie = User::factory()->create();
        $this->actingAs($newbie)->postJson('/games/valorant/mentors', ['about' => 'Імморт 3, граю за контролерів'])->assertStatus(422);

        $pro = User::factory()->create();
        $pro->forceFill(['created_at' => now()->subDays(40)])->save();
        $this->actingAs($pro)->postJson('/games/valorant/mentors', ['about' => 'Імморт 3, граю за контролерів'])->assertOk()->assertJsonPath('mentors.0.about', 'Імморт 3, граю за контролерів')->assertJsonPath('me', 'Імморт 3, граю за контролерів');
        $this->actingAs($pro)->deleteJson('/games/valorant/mentors')->assertOk()->assertJsonCount(0, 'mentors');
    }

    public function test_nickname_check_reports_free_addresses(): void
    {
        User::factory()->create(['username' => 'neorunner']);
        $this->actingAs(User::factory()->create())->postJson('/tools/nicknames/check', ['names' => ['NeoRunner', 'GhostByte', 'x']])
            ->assertOk()->assertJsonPath('free', ['ghostbyte', 'GhostByte']);
        $this->actingAs(User::factory()->create())->get('/tools/nicknames')->assertInertia(fn (Assert $page) => $page->component('tools/nicknames'));
    }
}
