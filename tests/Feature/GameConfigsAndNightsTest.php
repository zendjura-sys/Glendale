<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Game;
use App\Models\GameConfig;
use App\Models\GameNight;
use App\Models\User;
use App\Notifications\GameNightNotice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GameConfigsAndNightsTest extends TestCase
{
    use RefreshDatabase;

    private function game(string $slug = 'cs2', string $name = 'Counter-Strike 2'): Game
    {
        return Game::query()->create(['slug' => $slug, 'name' => $name, 'letter' => mb_substr($name, 0, 1), 'category' => 'pc', 'is_published' => true]);
    }

    private function friends(User $a, User $b): void
    {
        Friendship::query()->create(['requester_id' => $a->id, 'addressee_id' => $b->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
    }

    public function test_configs_share_like_copy_and_filter(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $cs = $this->game();
        $val = $this->game('valorant', 'Valorant');

        $this->actingAs($user)->post('/configs', ['game_id' => $cs->id, 'kind' => 'crosshair', 'title' => 'Маленький зелений', 'code' => 'CSGO-abcde-fghij'])->assertSessionHasNoErrors();
        $this->actingAs($user)->post('/configs', ['game_id' => $val->id, 'kind' => 'sensitivity', 'title' => '800 DPI · 0.35', 'code' => 'sens 0.35'])->assertSessionHasNoErrors();
        $this->actingAs($user)->post('/configs', ['game_id' => $cs->id, 'kind' => 'wrong', 'title' => 'Ні', 'code' => 'x'])->assertSessionHasErrors('kind');
        $config = GameConfig::query()->where('game_id', $cs->id)->firstOrFail();

        $this->actingAs($other)->postJson("/configs/{$config->id}/like")->assertOk()->assertJson(['liked' => true, 'likes' => 1]);
        $this->actingAs($other)->postJson("/configs/{$config->id}/copied")->assertOk()->assertJson(['copies' => 1]);

        $this->actingAs($other)->get('/configs?game=cs2')->assertInertia(fn (Assert $page) => $page
            ->component('configs/index')
            ->has('configs.data', 1)
            ->where('configs.data.0.code', 'CSGO-abcde-fghij')
            ->where('configs.data.0.liked', true)
            ->where('configs.data.0.mine', false));
        $this->actingAs($other)->get('/configs?kind=sensitivity')->assertInertia(fn (Assert $page) => $page->has('configs.data', 1));

        // Видалити може лише автор.
        $this->actingAs($other)->delete("/configs/{$config->id}")->assertForbidden();
        $this->actingAs($user)->delete("/configs/{$config->id}")->assertRedirect();
        $this->assertDatabaseMissing('game_configs', ['id' => $config->id]);
    }

    public function test_game_night_invite_vote_and_finalize(): void
    {
        Notification::fake();
        $host = User::factory()->create();
        $friend = User::factory()->create();
        $stranger = User::factory()->create();
        $this->friends($host, $friend);
        $game = $this->game();

        $this->actingAs($host)->post('/game-nights', [
            'title' => 'П’ятниця в CS',
            'friends' => [$friend->id, $stranger->id],
            'times' => [now()->addDay()->setTime(20, 0)->toIso8601String(), now()->addDays(2)->setTime(21, 0)->toIso8601String()],
            'games' => [$game->id],
        ])->assertRedirect();
        $night = GameNight::query()->firstOrFail();
        // Запрошуються лише друзі.
        $this->assertSame([$friend->id], $night->members()->pluck('users.id')->all());
        Notification::assertSentTo($friend, GameNightNotice::class, fn (GameNightNotice $n) => $n->type === 'invite');
        Notification::assertNotSentTo($stranger, GameNightNotice::class);

        $this->actingAs($stranger)->get("/game-nights/{$night->id}")->assertNotFound();
        $time = $night->options()->where('kind', 'time')->orderBy('starts_at')->firstOrFail();
        $this->actingAs($friend)->post("/game-nights/{$night->id}/options/{$time->id}/vote")->assertRedirect();
        $this->actingAs($friend)->post("/game-nights/{$night->id}/respond", ['status' => 'going'])->assertRedirect();
        $this->actingAs($friend)->get("/game-nights/{$night->id}")->assertInertia(fn (Assert $page) => $page
            ->component('game-nights/show')
            ->where('night.times.0.votes', 1)
            ->where('night.times.0.voted', true)
            ->where('night.my_status', 'going')
            ->where('night.is_host', false));

        $this->actingAs($friend)->post("/game-nights/{$night->id}/finalize", ['time' => $time->id])->assertForbidden();
        $gameOption = $night->options()->where('kind', 'game')->firstOrFail();
        $this->actingAs($host)->post("/game-nights/{$night->id}/finalize", ['time' => $time->id, 'game' => $gameOption->id])->assertRedirect();
        $this->assertSame('set', $night->fresh()->status);
        $this->assertSame($game->id, $night->fresh()->game_id);
        Notification::assertSentTo($friend, GameNightNotice::class, fn (GameNightNotice $n) => $n->type === 'set');

        // Після призначення голосувати не можна.
        $this->actingAs($friend)->post("/game-nights/{$night->id}/options/{$time->id}/vote")->assertStatus(422);
        $this->actingAs($host)->get('/game-nights')->assertInertia(fn (Assert $page) => $page->has('upcoming', 1)->has('friends', 1));
    }
}
