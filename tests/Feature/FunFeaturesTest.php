<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameJournalEntry;
use App\Models\GameScore;
use App\Models\Movie;
use App\Models\Track;
use App\Models\User;
use App\Services\Fun\DailyTrivia;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FunFeaturesTest extends TestCase
{
    use RefreshDatabase;

    public function test_movie_roulette_picks_by_filters_and_skips_watched(): void
    {
        $user = User::factory()->create();
        $anime = Movie::query()->create(['slug' => 'bleach', 'type' => 'anime', 'title' => 'Бліч', 'is_published' => true, 'genres' => ['екшн'], 'year' => 2004]);
        $seen = Movie::query()->create(['slug' => 'naruto', 'type' => 'anime', 'title' => 'Наруто', 'is_published' => true, 'genres' => ['екшн'], 'year' => 2002]);
        Movie::query()->create(['slug' => 'matrix', 'type' => 'movie', 'title' => 'Матриця', 'is_published' => true, 'genres' => ['фантастика'], 'year' => 1999]);
        Movie::query()->create(['slug' => 'hidden', 'type' => 'anime', 'title' => 'Чернетка', 'is_published' => false]);
        DB::table('movie_user')->insert(['user_id' => $user->id, 'movie_id' => $seen->id, 'status' => 'watched']);

        $this->actingAs($user)->get('/cinema/roulette')->assertInertia(fn (Assert $page) => $page->component('cinema/roulette')->has('genres'));
        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($user)->getJson('/cinema/roulette/spin?type=anime&unseen=1')->assertOk()->assertJsonPath('movie.id', $anime->id);
        }
        $this->actingAs($user)->getJson('/cinema/roulette/spin?genre=фантастика')->assertJsonPath('movie.slug', 'matrix');
        $this->actingAs($user)->getJson('/cinema/roulette/spin?type=serial')->assertOk()->assertJsonPath('movie', null);
    }

    public function test_daily_trivia_is_same_for_everyone_and_counts_once(): void
    {
        foreach (['CS2', 'Dota 2', 'Valorant', 'Minecraft', 'Fortnite', 'Apex', 'Rust'] as $i => $name) {
            Game::query()->create([
                'slug' => 'g'.$i, 'name' => $name, 'letter' => $name[0], 'category' => 'pc', 'is_published' => true,
                'platforms' => $i % 2 ? ['pc'] : ['pc', 'playstation'], 'genres' => [['Шутер', 'Стратегія', 'Пісочниця', 'Королівська битва'][$i % 4]],
                'released' => now()->subYears(3 + $i), 'popularity' => 100 - $i,
            ]);
        }
        $a = User::factory()->create();
        $b = User::factory()->create();
        $questions = app(DailyTrivia::class)->questions();
        $this->assertCount(DailyTrivia::QUESTIONS, $questions);

        $page = $this->actingAs($a)->get('/games/trivia')->assertInertia(fn (Assert $p) => $p
            ->component('games/trivia')
            ->has('questions', DailyTrivia::QUESTIONS)
            ->missing('questions.0.answer')
            ->where('played', null));
        $this->actingAs($b)->get('/games/trivia')->assertInertia(fn (Assert $p) => $p->where('questions.0.question', $questions[0]['question']));

        $right = array_column($questions, 'answer');
        $this->actingAs($a)->postJson('/games/trivia', ['answers' => $right])->assertOk()->assertJsonPath('score', DailyTrivia::QUESTIONS)->assertJsonPath('already', false);
        // Друга спроба не перезаписує результат.
        $this->actingAs($a)->postJson('/games/trivia', ['answers' => [null, null, null, null, null]])->assertJsonPath('score', DailyTrivia::QUESTIONS)->assertJsonPath('already', true);
        $this->actingAs($b)->get('/games/trivia')->assertInertia(fn (Assert $p) => $p->where('top.0.score', DailyTrivia::QUESTIONS));
        $this->assertSame(1, GameScore::query()->count());
    }

    public function test_music_quiz_round_scores_and_keeps_best_of_day(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/music/quiz')->assertStatus(422);
        foreach (range(1, 6) as $i) {
            Track::query()->create(['title' => 'Пісня '.$i, 'artist' => 'Гурт '.$i, 'duration' => 200, 'path' => "music/{$i}.mp3", 'mime' => 'audio/mpeg', 'size' => 1]);
        }
        $round = $this->actingAs($user)->postJson('/music/quiz')->assertOk()->assertJsonCount(5, 'questions')->json();
        $this->assertArrayNotHasKey('answer', $round['questions'][0]);

        $last = null;
        foreach ($round['questions'] as $i => $question) {
            // Перше питання — навмисно хибна відповідь, далі — правильні (відповідь бачимо з першої спроби).
            $probe = $this->actingAs($user)->postJson("/music/quiz/{$round['round']}", ['question' => $i, 'option' => 0])->json();
            $last = $probe;
        }
        $this->assertTrue($last['finished']);
        $this->assertSame($last['score'], GameScore::query()->where('kind', 'music_quiz')->value('score'));
        // Повторна відповідь на те саме питання не змінює рахунок.
        $again = $this->actingAs($user)->postJson("/music/quiz/{$round['round']}", ['question' => 0, 'option' => 3])->json();
        $this->assertSame($last['score'], $again['score']);
        $this->actingAs(User::factory()->create())->postJson("/music/quiz/{$round['round']}", ['question' => 0, 'option' => 0])->assertNotFound();
    }

    public function test_game_journal_private_by_default(): void
    {
        $owner = User::factory()->create();
        $friend = User::factory()->create();
        $game = Game::query()->create(['slug' => 'cs2', 'name' => 'CS2', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
        $this->actingAs($owner)->post('/journal', ['game_id' => $game->id, 'body' => 'Нарешті Global Elite', 'mood' => 'great', 'minutes' => 90])->assertRedirect();
        $this->actingAs($owner)->post('/journal', ['body' => 'Відкритий запис', 'mood' => 'good', 'is_public' => true])->assertRedirect();
        $this->actingAs($owner)->post('/journal', ['body' => 'Завтра', 'mood' => 'good', 'played_on' => now()->addDay()->toDateString()])->assertSessionHasErrors('played_on');

        $this->actingAs($owner)->get('/journal')->assertInertia(fn (Assert $p) => $p
            ->component('journal/index')->where('mine', true)->has('entries.data', 2)->where('stats.minutes', 90));
        $this->actingAs($friend)->get("/journal/{$owner->username}")->assertInertia(fn (Assert $p) => $p
            ->where('mine', false)->has('entries.data', 1)->where('entries.data.0.body', 'Відкритий запис'));

        $entry = GameJournalEntry::query()->where('body', 'Нарешті Global Elite')->sole();
        $this->actingAs($friend)->delete("/journal/{$entry->id}")->assertForbidden();
        $this->actingAs($owner)->delete("/journal/{$entry->id}")->assertRedirect();
        $this->assertSame(1, GameJournalEntry::query()->count());
    }
}
