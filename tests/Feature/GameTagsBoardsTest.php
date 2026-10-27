<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\PlayedPlace;
use App\Models\Post;
use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Games\GameTags;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** #Згадки ігор, лідерборд гри за 30 днів і «Сумісність N%». */
class GameTagsBoardsTest extends TestCase
{
    use RefreshDatabase;

    private function game(string $slug, string $name, ?string $aliases = null): Game
    {
        return Game::query()->create(['slug' => $slug, 'name' => $name, 'letter' => mb_substr($name, 0, 1), 'category' => 'pc', 'is_published' => true, 'aliases' => $aliases]);
    }

    private function played(User $user, Game $game, int $days): void
    {
        for ($i = 0; $i < $days; $i++) {
            DB::table('play_days')->insert(['user_id' => $user->id, 'kind' => PlayedPlace::GAME, 'subject_id' => $game->id, 'day' => now()->subDays($i)->toDateString()]);
        }
    }

    public function test_hashtags_link_games_and_show_on_game_page(): void
    {
        $cs = $this->game('counter-strike-2', 'Counter-Strike 2', 'CS2 | КС2');
        $this->game('dota-2', 'Dota 2');
        $author = User::factory()->create();

        $this->assertSame(['cs2', 'dota-2', 'не_гра'], GameTags::extract('Го в #cs2 чи #dota-2? #не_гра, а це не тег: a#b, &#123;'));

        $this->actingAs($author)->post('/posts', ['body' => 'Хто в #CS2 сьогодні? І #кс2 теж', 'visibility' => 'public'])->assertSessionHasNoErrors();
        $post = Post::query()->latest('id')->firstOrFail();
        $this->assertSame([$cs->id], DB::table('post_game')->where('post_id', $post->id)->pluck('game_id')->all());

        $this->actingAs($author)->get('/feed?tab=fresh')->assertOk();
        $this->actingAs($author)->get("/posts/{$post->id}")->assertInertia(fn (Assert $page) => $page
            ->where('post.games.0.slug', 'counter-strike-2')->where('post.games.0.tag', 'CS2'));
        $this->get('/games/counter-strike-2')->assertInertia(fn (Assert $page) => $page
            ->where('tagged_posts.0.id', $post->id));

        // Редагування прибрало тег — запис зникає зі сторінки гри.
        $post->update(['body' => 'Передумав']);
        $this->assertSame(0, DB::table('post_game')->where('post_id', $post->id)->count());
    }

    public function test_leaderboard_counts_play_days_with_friends_tab_and_my_place(): void
    {
        $game = $this->game('dota-2', 'Dota 2');
        [$me, $friend, $pro] = User::factory()->count(3)->create()->all();
        app(FriendshipService::class)->request($me, $friend);
        app(FriendshipService::class)->accept($friend, $me);
        $this->played($pro, $game, 20);
        $this->played($friend, $game, 7);
        $this->played($me, $game, 3);
        DB::table('play_days')->insert(['user_id' => $me->id, 'kind' => PlayedPlace::GAME, 'subject_id' => $game->id, 'day' => now()->subDays(45)->toDateString()]);

        $this->actingAs($me)->get('/games/dota-2')->assertInertia(fn (Assert $page) => $page
            ->where('leaderboard.top.0.user.id', $pro->id)
            ->where('leaderboard.top.0.days', 20)
            ->has('leaderboard.top', 3)
            ->where('leaderboard.friends.0.user.id', $friend->id)
            ->has('leaderboard.friends', 2)
            ->where('leaderboard.me', ['place' => 3, 'days' => 3]));
    }

    public function test_compatibility_on_profile(): void
    {
        $dota = $this->game('dota-2', 'Dota 2');
        $cs = $this->game('cs2', 'CS2');
        $me = User::factory()->create();
        $mate = User::factory()->create();
        $stranger = User::factory()->create();
        $this->played($me, $dota, 2);
        $this->played($me, $cs, 2);
        $this->played($mate, $dota, 1);
        $this->played($stranger, $this->game('fifa', 'FIFA'), 1);

        $this->actingAs($me)->get("/{$mate->username}")->assertInertia(fn (Assert $page) => $page
            ->where('compatibility.score', 55)
            ->where('compatibility.reasons.0.type', 'games')
            ->where('compatibility.reasons.0.names', ['Dota 2']));
        $this->actingAs($me)->get("/{$stranger->username}")->assertInertia(fn (Assert $page) => $page->where('compatibility.score', 0));
        $this->actingAs($me)->get("/{$me->username}")->assertInertia(fn (Assert $page) => $page->where('compatibility', null));
    }
}
