<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Game;
use App\Models\GameBacklog;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Games\CommunityRatings;
use App\Support\Plugins\Plugins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Бэклог ігор: стани гри, своя й чужа дошка, профіль, друзі, міст застосунку. */
class GameBacklogTest extends TestCase
{
    use RefreshDatabase;

    private function game(string $slug = 'apex'): Game
    {
        return Game::query()->create(['slug' => $slug, 'name' => ucfirst($slug), 'letter' => strtoupper($slug[0]), 'category' => 'pc', 'is_published' => true]);
    }

    public function test_status_moves_between_columns_and_opens_rating(): void
    {
        $user = User::factory()->create();
        $game = $this->game();

        $this->actingAs($user)->putJson('/games/apex/backlog', ['status' => 'want'])->assertOk()
            ->assertJsonPath('status', 'want')->assertJsonPath('counts.want', 1);
        // «Хочу» — ще не грав.
        $this->assertFalse(app(CommunityRatings::class)->played($user, $game));

        $this->actingAs($user)->putJson('/games/apex/backlog', ['status' => 'playing'])->assertOk()->assertJsonPath('counts.want', 0);
        $this->assertSame(1, GameBacklog::query()->count());
        $this->assertTrue(app(CommunityRatings::class)->played($user, $game));

        $this->actingAs($user)->get('/games/apex')->assertInertia(fn (Assert $page) => $page->where('backlog', 'playing'));
        $this->actingAs($user)->get('/games/backlog')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('games/backlog')->where('mine', true)->where('board.playing.0.game.slug', 'apex'));

        $this->actingAs($user)->putJson('/games/apex/backlog', ['status' => null])->assertOk();
        $this->assertSame(0, GameBacklog::query()->count());
        $this->actingAs($user)->putJson('/games/apex/backlog', ['status' => 'bogus'])->assertUnprocessable();
    }

    public function test_private_board_is_for_friends_and_friends_playing_is_shown(): void
    {
        $owner = User::factory()->create(['username' => 'owner', 'is_private' => true]);
        $friend = User::factory()->create();
        $stranger = User::factory()->create();
        Friendship::query()->create(['requester_id' => $owner->id, 'addressee_id' => $friend->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $this->game();
        $this->actingAs($owner)->putJson('/games/apex/backlog', ['status' => 'playing'])->assertOk();

        $this->actingAs($stranger)->get('/games/backlog/owner')->assertNotFound();
        $this->actingAs($friend)->get('/games/backlog/owner')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('mine', false)->where('board.playing.0.game.slug', 'apex'));
        $this->actingAs($friend)->get('/games/backlog')
            ->assertInertia(fn (Assert $page) => $page->where('friends.0.user.id', $owner->id)->where('friends.0.game.slug', 'apex'));

        $this->actingAs($friend)->get('/owner')
            ->assertInertia(fn (Assert $page) => $page->where('backlog.counts.playing', 1)->where('backlog.playing.0.slug', 'apex'));
        $this->actingAs($stranger)->get('/owner')->assertInertia(fn (Assert $page) => $page->where('backlog', null));
    }

    public function test_app_bridge_and_plugin_switch(): void
    {
        $user = User::factory()->create();
        $this->game();
        $token = app(ApiTokens::class)->issue($user, 'android');

        $this->withToken($token)->putJson('/api/v1/site/games/apex/backlog', ['status' => 'done'])->assertOk()->assertJsonPath('status', 'done');
        $this->withToken($token)->getJson('/api/v1/site/games/backlog')->assertOk()->assertJsonPath('board.done.0.game.slug', 'apex');

        app(Plugins::class)->set('game_backlog', false);
        $this->actingAs($user)->get('/games/backlog')->assertNotFound();
        $this->actingAs($user)->putJson('/games/apex/backlog', ['status' => 'want'])->assertNotFound();
        $this->actingAs($user)->get('/games/apex')->assertInertia(fn (Assert $page) => $page->where('backlog', null)->where('backlog_on', false));
    }
}
