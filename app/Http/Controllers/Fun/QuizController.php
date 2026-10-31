<?php

namespace App\Http\Controllers\Fun;

use App\Http\Controllers\Controller;
use App\Models\GameScore;
use App\Services\Fun\DailyTrivia;
use App\Services\Fun\MusicQuiz;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Міні-ігри: «Вгадай пісню» в «Музиці» й щоденна вікторина про ігри. */
class QuizController extends Controller
{
    public function music(Request $request): Response
    {
        app(Plugins::class)->ensure('music_quiz');

        return Inertia::render('music/quiz', [
            'top' => GameScore::top(MusicQuiz::KIND),
            'best' => GameScore::query()->where('user_id', $request->user()->id)->where('kind', MusicQuiz::KIND)->whereDate('day', today())->value('score'),
            'clip' => MusicQuiz::CLIP,
        ]);
    }

    public function musicStart(Request $request, MusicQuiz $quiz): JsonResponse
    {
        app(Plugins::class)->ensure('music_quiz');
        $round = $quiz->start($request->user());
        abort_if($round === null, 422, 'У «Музиці» поки замало пісень для гри.');

        return response()->json($round);
    }

    public function musicAnswer(Request $request, string $round, MusicQuiz $quiz): JsonResponse
    {
        app(Plugins::class)->ensure('music_quiz');
        $data = $request->validate([
            'question' => ['required', 'integer', 'min:0', 'max:20'],
            'option' => ['required', 'integer', 'min:0', 'max:3'],
        ]);
        $result = $quiz->answer($request->user(), $round, (int) $data['question'], (int) $data['option']);
        abort_if($result === null, 404, 'Раунд завершився — почніть новий.');

        return response()->json($result);
    }

    public function trivia(Request $request, DailyTrivia $trivia): Response
    {
        app(Plugins::class)->ensure('game_trivia');

        return Inertia::render('games/trivia', $trivia->state($request->user()));
    }

    public function triviaSubmit(Request $request, DailyTrivia $trivia): JsonResponse
    {
        app(Plugins::class)->ensure('game_trivia');
        $data = $request->validate([
            'answers' => ['required', 'array', 'max:'.DailyTrivia::QUESTIONS],
            'answers.*' => ['nullable', 'integer', 'min:0', 'max:3'],
        ]);
        $answers = array_map(fn ($a) => $a === null ? null : (int) $a, array_values($data['answers']));

        return response()->json([...$trivia->submit($request->user(), $answers), 'top' => GameScore::top(DailyTrivia::KIND)]);
    }
}
