<?php

namespace App\Http\Controllers;

use App\Events\CommunityQuizUpdated;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\CommunityQuiz;
use App\Models\CommunityQuizAnswer;
use App\Models\User;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Живі вікторини спільнот (№225). Ведучий (керівник спільноти) складає питання, запускає й
 * гортає «Далі»: питання → показ відповіді → наступне … → підсумок. Учасники відповідають,
 * поки йде таймер; бали — 500 за правильну відповідь плюс до 500 за швидкість.
 */
class CommunityQuizController extends Controller
{
    /** Запас на затримку мережі після таймера, секунд. */
    private const GRACE = 2;

    /** Поточна (жива чи остання) вікторина спільноти і стан для глядача. */
    public function show(Request $request, Community $community): JsonResponse
    {
        app(Plugins::class)->ensure('community_quiz');
        abort_unless($this->member($request->user(), $community), 403);
        $quiz = CommunityQuiz::query()->where('community_id', $community->id)
            ->where(fn ($q) => $q->whereIn('phase', [...CommunityQuiz::LIVE, CommunityQuiz::DRAFT])
                ->orWhere('updated_at', '>=', now()->subHours(6)))
            ->latest('id')->first();

        return response()->json([
            'quiz' => $quiz ? $this->state($quiz, $request->user()) : null,
            'can_host' => $this->manages($request->user(), $community),
            // Канал community.{id}: «quiz.updated» — перечитати стан.
            'community_id' => $community->id,
        ]);
    }

    public function store(Request $request, Community $community): JsonResponse
    {
        app(Plugins::class)->ensure('community_quiz');
        abort_unless($this->manages($request->user(), $community), 403);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:120'],
            'seconds' => ['nullable', 'integer', 'min:10', 'max:60'],
            'questions' => ['required', 'array', 'min:1', 'max:20'],
            'questions.*.q' => ['required', 'string', 'min:2', 'max:200'],
            'questions.*.options' => ['required', 'array', 'min:2', 'max:4'],
            'questions.*.options.*' => ['required', 'string', 'max:80'],
            'questions.*.answer' => ['required', 'integer', 'min:0', 'max:3'],
        ], [], ['questions.*.q' => 'питання', 'questions.*.options.*' => 'варіант']);
        foreach ($data['questions'] as $i => $question) {
            abort_if($question['answer'] >= count($question['options']), 422, 'Питання '.($i + 1).': правильна відповідь має бути серед варіантів.');
        }
        abort_if(CommunityQuiz::query()->where('community_id', $community->id)->whereIn('phase', CommunityQuiz::LIVE)->exists(), 422, 'У спільноті вже йде вікторина.');

        // Чернетка одна: нова замінює попередню.
        CommunityQuiz::query()->where('community_id', $community->id)->where('phase', CommunityQuiz::DRAFT)->delete();
        $quiz = CommunityQuiz::query()->create([
            'community_id' => $community->id,
            'host_id' => $request->user()->id,
            'title' => trim($data['title']),
            'questions' => array_values(array_map(fn (array $q) => [
                'q' => trim($q['q']),
                'options' => array_values(array_map('trim', $q['options'])),
                'answer' => (int) $q['answer'],
            ], $data['questions'])),
            'seconds' => (int) ($data['seconds'] ?? 20),
            'phase' => CommunityQuiz::DRAFT,
            'current' => 0,
        ]);
        Log::info('community quiz: created', ['community' => $community->id, 'quiz' => $quiz->id, 'by' => $request->user()->id]);

        return response()->json(['quiz' => $this->state($quiz, $request->user())]);
    }

    /** «Далі»: старт → питання → відповідь → наступне питання … → підсумок. */
    public function advance(Request $request, Community $community, CommunityQuiz $quiz): JsonResponse
    {
        app(Plugins::class)->ensure('community_quiz');
        abort_unless($quiz->community_id === $community->id && $this->manages($request->user(), $community), 403);
        abort_if($quiz->phase === CommunityQuiz::DONE, 422, 'Вікторину вже завершено.');
        $last = count($quiz->questions) - 1;
        [$phase, $current] = match ($quiz->phase) {
            CommunityQuiz::DRAFT => [CommunityQuiz::QUESTION, 0],
            CommunityQuiz::QUESTION => [CommunityQuiz::REVEAL, $quiz->current],
            default => $quiz->current >= $last ? [CommunityQuiz::DONE, $quiz->current] : [CommunityQuiz::QUESTION, $quiz->current + 1],
        };
        $quiz->forceFill(['phase' => $phase, 'current' => $current, 'phase_at' => now()])->save();
        broadcast(new CommunityQuizUpdated($community->id, $quiz->id, $phase));

        return response()->json(['quiz' => $this->state($quiz, $request->user())]);
    }

    public function answer(Request $request, Community $community, CommunityQuiz $quiz): JsonResponse
    {
        app(Plugins::class)->ensure('community_quiz');
        abort_unless($quiz->community_id === $community->id && $this->member($request->user(), $community), 403);
        $data = $request->validate(['question' => ['required', 'integer'], 'choice' => ['required', 'integer', 'min:0', 'max:3']]);
        abort_unless($quiz->phase === CommunityQuiz::QUESTION && (int) $data['question'] === $quiz->current, 422, 'Це питання вже закрито.');
        $elapsed = $quiz->phase_at ? max(0, now()->getTimestamp() - $quiz->phase_at->getTimestamp()) : 0;
        abort_if($elapsed > $quiz->seconds + self::GRACE, 422, 'Час на відповідь вийшов.');

        $question = $quiz->questions[$quiz->current];
        $correct = (int) $data['choice'] === (int) $question['answer'];
        $left = max(0, $quiz->seconds - $elapsed);
        $points = $correct ? 500 + (int) round(500 * $left / max(1, $quiz->seconds)) : 0;
        $saved = CommunityQuizAnswer::query()->firstOrCreate(
            ['community_quiz_id' => $quiz->id, 'user_id' => $request->user()->id, 'question' => $quiz->current],
            ['choice' => (int) $data['choice'], 'points' => $points],
        );

        // Правильність не розкриваємо до показу відповіді — лише «прийнято».
        return response()->json(['ok' => true, 'choice' => $saved->choice]);
    }

    /**
     * Стан для глядача: правильна відповідь — лише після показу; бали — свої й таблиця лідерів.
     *
     * @return array<string, mixed>
     */
    private function state(CommunityQuiz $quiz, User $viewer): array
    {
        $question = $quiz->questions[$quiz->current] ?? null;
        $open = in_array($quiz->phase, [CommunityQuiz::REVEAL, CommunityQuiz::DONE], true);
        $host = $quiz->host_id === $viewer->id || $this->manages($viewer, $quiz->community);
        $mine = CommunityQuizAnswer::query()->where('community_quiz_id', $quiz->id)->where('user_id', $viewer->id)->get();
        $current = $mine->firstWhere('question', $quiz->current);

        return [
            'id' => $quiz->id,
            'title' => $quiz->title,
            'phase' => $quiz->phase,
            'index' => $quiz->current,
            'total' => count($quiz->questions),
            'seconds' => $quiz->seconds,
            'phase_at' => $quiz->phase_at?->toIso8601String(),
            'question' => $quiz->phase === CommunityQuiz::DRAFT && ! $host ? null : ($question ? [
                'q' => $question['q'],
                'options' => $question['options'],
                'answer' => $open || ($host && $quiz->phase === CommunityQuiz::DRAFT) ? $question['answer'] : null,
            ] : null),
            'my_choice' => $current?->choice,
            'my_points' => (int) $mine->sum('points'),
            'answered' => $quiz->phase === CommunityQuiz::DRAFT ? 0 : CommunityQuizAnswer::query()->where('community_quiz_id', $quiz->id)->where('question', $quiz->current)->count(),
            'leaders' => $open ? $this->leaders($quiz) : [],
        ];
    }

    /**
     * @return list<array{user: array<string, mixed>, points: int}>
     */
    private function leaders(CommunityQuiz $quiz): array
    {
        $rows = DB::table('community_quiz_answers')->where('community_quiz_id', $quiz->id)
            ->select('user_id', DB::raw('SUM(points) as total'))->groupBy('user_id')
            ->orderByDesc('total')->limit(10)->get();
        $users = User::query()->whereIn('id', $rows->pluck('user_id')->all())->get()->keyBy('id');
        $out = [];
        foreach ($rows as $row) {
            $user = $users->get($row->user_id);
            if ($user !== null) {
                $out[] = ['user' => $user->toCard(), 'points' => (int) $row->total];
            }
        }

        return $out;
    }

    private function member(?User $user, Community $community): bool
    {
        return $user !== null && ($community->membershipFor($user)?->status === CommunityMember::STATUS_ACTIVE || $user->isStaff());
    }

    private function manages(?User $user, Community $community): bool
    {
        return $user !== null && ((bool) $community->membershipFor($user)?->isManager() || $user->isStaff());
    }
}
