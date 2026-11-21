<?php

namespace Tests\Feature;

use App\Events\CommunityQuizUpdated;
use App\Models\Community;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/** №225: живі вікторини спільнот — ведучий, відповіді на час, бали, лідери; «Зараз» у лобі. */
class CommunityQuizTest extends TestCase
{
    use RefreshDatabase;

    public function test_live_quiz_round_trip(): void
    {
        Event::fake([CommunityQuizUpdated::class]);
        [$host, $fast, $wrong, $stranger] = User::factory()->count(4)->create();
        $community = app(CommunityService::class)->create($host, ['name' => 'Квіз-клуб', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_OPEN, 'category' => 'games']);
        foreach ([$fast, $wrong] as $member) {
            $this->actingAs($member)->post(route('communities.join', $community))->assertRedirect();
        }
        $base = "/c/{$community->slug}/quiz";

        $this->actingAs($fast)->postJson($base, ['title' => 'Х', 'questions' => []])->assertForbidden();
        $quiz = $this->actingAs($host)->postJson($base, [
            'title' => 'Ігри 2000-х',
            'seconds' => 20,
            'questions' => [
                ['q' => 'Рік виходу Half-Life 2?', 'options' => ['2002', '2004', '2006'], 'answer' => 1],
                ['q' => 'Хто створив Minecraft?', 'options' => ['Notch', 'Valve'], 'answer' => 0],
            ],
        ])->assertOk()->json('quiz');
        $this->assertSame('draft', $quiz['phase']);

        // Чернетку учасники не бачать (питання сховані).
        $this->actingAs($fast)->getJson($base)->assertOk()->assertJsonPath('quiz.question', null);
        $this->actingAs($stranger)->getJson($base)->assertForbidden();

        $this->actingAs($host)->postJson("{$base}/{$quiz['id']}/advance")->assertOk()->assertJsonPath('quiz.phase', 'question');
        // Під час питання правильна відповідь прихована.
        $this->actingAs($fast)->getJson($base)->assertJsonPath('quiz.question.answer', null)->assertJsonPath('quiz.question.q', 'Рік виходу Half-Life 2?');

        $this->actingAs($fast)->postJson("{$base}/{$quiz['id']}/answer", ['question' => 0, 'choice' => 1])->assertOk();
        $this->actingAs($wrong)->postJson("{$base}/{$quiz['id']}/answer", ['question' => 0, 'choice' => 2])->assertOk();
        // Повторна відповідь не змінює першої.
        $this->actingAs($fast)->postJson("{$base}/{$quiz['id']}/answer", ['question' => 0, 'choice' => 0])->assertJsonPath('choice', 1);
        $this->actingAs($fast)->getJson('/me/now')->assertJsonPath('quizzes.0.title', 'Ігри 2000-х');

        $this->actingAs($host)->postJson("{$base}/{$quiz['id']}/advance")->assertJsonPath('quiz.phase', 'reveal');
        $state = $this->actingAs($fast)->getJson($base)->json('quiz');
        $this->assertSame(1, $state['question']['answer']);
        $this->assertGreaterThan(500, $state['my_points']);
        $this->assertSame($fast->id, $state['leaders'][0]['user']['id']);
        $this->assertSame(0, $this->actingAs($wrong)->getJson($base)->json('quiz.my_points'));
        // Після показу відповіді відповідати вже не можна.
        $this->actingAs($wrong)->postJson("{$base}/{$quiz['id']}/answer", ['question' => 0, 'choice' => 1])->assertStatus(422);

        $this->actingAs($host)->postJson("{$base}/{$quiz['id']}/advance")->assertJsonPath('quiz.index', 1);
        $this->actingAs($host)->postJson("{$base}/{$quiz['id']}/advance")->assertJsonPath('quiz.phase', 'reveal');
        $this->actingAs($host)->postJson("{$base}/{$quiz['id']}/advance")->assertJsonPath('quiz.phase', 'done');
        $this->actingAs($host)->postJson("{$base}/{$quiz['id']}/advance")->assertStatus(422);
        $this->actingAs($fast)->getJson('/me/now')->assertJsonPath('quizzes', []);

        Event::assertDispatchedTimes(CommunityQuizUpdated::class, 5);
        $this->withToken($this->app_token($fast))->getJson("/api/v1/site{$base}")->assertOk()->assertJsonPath('quiz.phase', 'done');
    }

    private function app_token(User $user): string
    {
        return app(ApiTokens::class)->issue($user, 'android');
    }
}
