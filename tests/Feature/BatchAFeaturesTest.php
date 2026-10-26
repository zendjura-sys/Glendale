<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Game;
use App\Models\PlayedPlace;
use App\Models\Story;
use App\Models\User;
use App\Services\Wrapped\YearInReview;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Оцінка гравців GameCon, ігровий рік у Wrapped, опитування в історіях. */
class BatchAFeaturesTest extends TestCase
{
    use RefreshDatabase;

    private function game(): Game
    {
        return Game::query()->create(['slug' => 'dota-2', 'name' => 'Dota 2', 'letter' => 'D', 'category' => 'pc', 'is_published' => true]);
    }

    public function test_only_players_rate_and_average_needs_three_votes(): void
    {
        $game = $this->game();
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/games/dota-2/rating', ['score' => 9])->assertUnprocessable();
        $this->actingAs($user)->postJson('/games/dota-2/played')->assertOk()->assertJsonPath('played', true);
        $this->actingAs($user)->postJson('/games/dota-2/rating', ['score' => 9])->assertOk()
            ->assertJsonPath('mine', 9)->assertJsonPath('count', 1)->assertJsonPath('average', null);

        foreach ([7, 8] as $score) {
            $other = User::factory()->create();
            PlayedPlace::query()->create(['user_id' => $other->id, 'kind' => PlayedPlace::GAME, 'subject_id' => $game->id]);
            $this->actingAs($other)->postJson('/games/dota-2/rating', ['score' => $score])->assertOk();
        }
        $this->actingAs($user)->get('/games/dota-2')->assertInertia(fn ($page) => $page
            ->where('community_rating.average', 8)->where('community_rating.count', 3)->where('community_rating.mine', 9));

        $this->actingAs($user)->postJson('/games/dota-2/rating', ['score' => null])->assertJsonPath('mine', null)->assertJsonPath('count', 2);
    }

    public function test_wrapped_counts_games_and_teammates(): void
    {
        $game = $this->game();
        $other = Game::query()->create(['slug' => 'cs2', 'name' => 'CS2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
        $user = User::factory()->create();
        $friend = User::factory()->create();
        Friendship::query()->create(['requester_id' => $user->id, 'addressee_id' => $friend->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $year = (int) now()->format('Y');
        foreach (['01-10', '01-11', '02-03'] as $d) {
            DB::table('play_days')->insert(['user_id' => $user->id, 'kind' => PlayedPlace::GAME, 'subject_id' => $game->id, 'day' => "$year-$d"]);
        }
        DB::table('play_days')->insert(['user_id' => $user->id, 'kind' => PlayedPlace::GAME, 'subject_id' => $other->id, 'day' => "$year-03-01"]);
        foreach (['01-10', '02-03'] as $d) {
            DB::table('play_days')->insert(['user_id' => $friend->id, 'kind' => PlayedPlace::GAME, 'subject_id' => $game->id, 'day' => "$year-$d"]);
        }

        $games = app(YearInReview::class)->build($user, $year)['games'];
        $this->assertSame(2, $games['games_count']);
        $this->assertSame(['Dota 2', 3], [$games['top_list'][0]['name'], $games['top_list'][0]['days']]);
        $this->assertSame($friend->id, $games['teammates'][0]['user']['id']);
        $this->assertSame(2, $games['teammates'][0]['days']);
    }

    public function test_story_poll_votes_once_and_reveals_results(): void
    {
        $author = User::factory()->create();
        $viewer = User::factory()->create();
        $story = Story::query()->create([
            'user_id' => $author->id, 'media_type' => Story::TYPE_IMAGE, 'path' => 'stories/x.jpg', 'width' => 10, 'height' => 10,
            'duration' => 6, 'privacy' => 'everyone', 'expires_at' => now()->addDay(),
            'poll' => ['question' => 'Во що граємо?', 'options' => ['CS2', 'Dota 2']],
        ]);

        $this->actingAs($viewer)->getJson("/stories/{$story->id}/poll")->assertJsonPath('poll.options.0.percent', null);
        $this->actingAs($viewer)->postJson("/stories/{$story->id}/vote", ['option' => 1])->assertOk()
            ->assertJsonPath('poll.voted', 1)->assertJsonPath('poll.options.1.percent', 100)->assertJsonPath('poll.total', 1);
        // Повторний голос не змінює вибір.
        $this->actingAs($viewer)->postJson("/stories/{$story->id}/vote", ['option' => 0])->assertJsonPath('poll.voted', 1);
        $this->actingAs($viewer)->postJson("/stories/{$story->id}/vote", ['option' => 5])->assertUnprocessable();
        $this->actingAs($author)->getJson("/stories/{$story->id}/poll")->assertJsonPath('poll.total', 1);
        $this->actingAs($author)->postJson("/stories/{$story->id}/vote", ['option' => 0])->assertUnprocessable();
    }
}
