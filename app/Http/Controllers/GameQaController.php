<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\GameAnswer;
use App\Models\GameMentor;
use App\Models\GameQuestion;
use App\Notifications\GameQaNotice;
use App\Services\Moderation\ContentFilter;
use App\Support\Plugins\Plugins;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Питання гравців і наставники на сторінці гри. */
class GameQaController extends Controller
{
    /** Скільки днів має бути акаунту, щоб стати наставником. */
    public const MENTOR_MIN_DAYS = 14;

    public function questions(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_qa');
        $viewer = $request->user();
        $questions = GameQuestion::query()->with(['user', 'answers' => fn ($q) => $q->with('user')->orderByDesc('votes_count')->orderBy('id')])
            ->where('game_id', $game->id)
            ->orderByRaw('solved_answer_id is null desc')->orderByDesc('id')
            ->limit(30)->get();
        $answerIds = $questions->flatMap(fn (GameQuestion $q) => $q->answers->pluck('id'))->all();
        $voted = $viewer && $answerIds !== [] ? DB::table('game_answer_votes')->where('user_id', $viewer->id)->whereIn('answer_id', $answerIds)->pluck('answer_id')->all() : [];

        return response()->json(['questions' => $questions->map(fn (GameQuestion $q) => [
            'id' => $q->id,
            'title' => $q->title,
            'body' => $q->body,
            'author' => $q->user?->toCard(),
            'own' => $viewer?->id === $q->user_id,
            'solved_answer_id' => $q->solved_answer_id,
            'created_at' => $q->created_at->toIso8601String(),
            'answers' => $q->answers->map(fn (GameAnswer $a) => [
                'id' => $a->id,
                'body' => $a->body,
                'author' => $a->user?->toCard(),
                'own' => $viewer?->id === $a->user_id,
                'votes' => $a->votes_count,
                'voted' => in_array($a->id, $voted),
                'created_at' => $a->created_at->toIso8601String(),
            ])->values()->all(),
        ])->values()->all()]);
    }

    public function ask(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_qa');
        $data = $request->validate(['title' => ['required', 'string', 'min:8', 'max:160'], 'body' => ['nullable', 'string', 'max:3000']]);
        $filter = app(ContentFilter::class);
        $filter->ensureCanPost($request->user());
        GameQuestion::query()->create([
            'game_id' => $game->id,
            'user_id' => $request->user()->id,
            'title' => (string) $filter->clean(trim($data['title'])),
            'body' => $filter->clean(trim((string) ($data['body'] ?? '')) ?: null),
        ]);

        return $this->questions($request, $game);
    }

    public function answer(Request $request, Game $game, GameQuestion $question): JsonResponse
    {
        app(Plugins::class)->ensure('game_qa');
        abort_unless($question->game_id === $game->id, 404);
        $data = $request->validate(['body' => ['required', 'string', 'min:2', 'max:3000']]);
        $filter = app(ContentFilter::class);
        $filter->ensureCanPost($request->user());
        $question->answers()->create(['user_id' => $request->user()->id, 'body' => (string) $filter->clean(trim($data['body']))]);
        $question->forceFill(['answers_count' => $question->answers()->count()])->save();
        if ($question->user && $question->user_id !== $request->user()->id) {
            $question->user->notify(new GameQaNotice($request->user(), $question->setRelation('game', $game)));
        }
        // Відповів наставник цієї гри — рахуємо допомогу.
        GameMentor::query()->where('game_id', $game->id)->where('user_id', $request->user()->id)->increment('helped_count');

        return $this->questions($request, $game);
    }

    public function vote(Request $request, Game $game, GameAnswer $answer): JsonResponse
    {
        app(Plugins::class)->ensure('game_qa');
        abort_unless($answer->question?->game_id === $game->id, 404);
        abort_if($answer->user_id === $request->user()->id, 422, 'За свою відповідь голосувати не можна.');
        $key = ['answer_id' => $answer->id, 'user_id' => $request->user()->id];
        DB::table('game_answer_votes')->where($key)->exists() ? DB::table('game_answer_votes')->where($key)->delete() : DB::table('game_answer_votes')->insert($key);
        $answer->forceFill(['votes_count' => DB::table('game_answer_votes')->where('answer_id', $answer->id)->count()])->save();

        return $this->questions($request, $game);
    }

    /** Автор питання позначає відповідь, що допомогла (або знімає позначку). */
    public function solve(Request $request, Game $game, GameQuestion $question): JsonResponse
    {
        abort_unless($question->game_id === $game->id, 404);
        abort_unless($question->user_id === $request->user()->id, 403);
        $data = $request->validate(['answer_id' => ['nullable', 'integer']]);
        $answerId = $data['answer_id'] ?? null;
        abort_if($answerId !== null && ! $question->answers()->whereKey($answerId)->exists(), 422);
        $question->update(['solved_answer_id' => $answerId]);

        return $this->questions($request, $game);
    }

    public function destroyQuestion(Request $request, Game $game, GameQuestion $question): JsonResponse
    {
        abort_unless($question->game_id === $game->id, 404);
        abort_unless($question->user_id === $request->user()->id || $request->user()->isStaff(), 403);
        $question->delete();

        return $this->questions($request, $game);
    }

    public function mentors(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_mentors');
        $mentors = GameMentor::query()->with('user')->where('game_id', $game->id)
            ->orderByDesc('helped_count')->orderBy('id')->limit(30)->get()
            ->filter(fn (GameMentor $m) => $m->user !== null && ! $m->user->isFrozen());

        return response()->json([
            'mentors' => $mentors->map(fn (GameMentor $m) => [...$m->user->toCard(), 'about' => $m->about, 'helped' => $m->helped_count])->values()->all(),
            'me' => $request->user() ? GameMentor::query()->where('game_id', $game->id)->where('user_id', $request->user()->id)->value('about') : null,
        ]);
    }

    public function becomeMentor(Request $request, Game $game): JsonResponse
    {
        app(Plugins::class)->ensure('game_mentors');
        $user = $request->user();
        if ($user->created_at === null || $user->created_at->gt(now()->subDays(self::MENTOR_MIN_DAYS))) {
            throw ValidationException::withMessages(['about' => 'Наставником можна стати через '.self::MENTOR_MIN_DAYS.' днів після реєстрації.']);
        }
        $data = $request->validate(['about' => ['required', 'string', 'min:10', 'max:300']]);
        GameMentor::query()->updateOrCreate(['game_id' => $game->id, 'user_id' => $user->id], ['about' => (string) app(ContentFilter::class)->clean(trim($data['about']))]);

        return $this->mentors($request, $game);
    }

    public function leaveMentors(Request $request, Game $game): JsonResponse
    {
        GameMentor::query()->where('game_id', $game->id)->where('user_id', $request->user()->id)->delete();

        return $this->mentors($request, $game);
    }
}
