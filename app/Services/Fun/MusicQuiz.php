<?php

namespace App\Services\Fun;

use App\Models\GameScore;
use App\Models\Track;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * «Вгадай пісню»: 5 уривків з каталогу «Музики», на кожен — 4 варіанти.
 * Правильні відповіді живуть лише в кеші раунду; найкращий результат дня — у таблиці.
 */
class MusicQuiz
{
    public const QUESTIONS = 5;

    public const KIND = 'music_quiz';

    /** Скільки секунд звучить уривок. */
    public const CLIP = 15;

    /**
     * Новий раунд. null — у каталозі замало пісень.
     *
     * @return array{round: string, questions: list<array{audio: string, start: int, options: list<string>}>}|null
     */
    public function start(User $user): ?array
    {
        $tracks = Track::query()->ready()->inRandomOrder()->limit(40)->get();
        $tracks = $tracks->unique(fn (Track $t) => $this->label($t))->values();
        if ($tracks->count() < 4) {
            return null;
        }
        $picked = $tracks->take(min(self::QUESTIONS, $tracks->count()));
        $questions = [];
        $answers = [];
        foreach ($picked as $track) {
            $others = $tracks->where('id', '!=', $track->id)->shuffle()->take(3)->map(fn (Track $t) => $this->label($t))->all();
            $options = array_values(collect([$this->label($track), ...$others])->shuffle()->all());
            $answers[] = (int) array_search($this->label($track), $options, true);
            $length = max(0, $track->duration - self::CLIP);
            $questions[] = [
                'audio' => $track->url,
                // Уривок з середини — без тиші на початку й упізнаваного вступу.
                'start' => $length > 0 ? random_int((int) ($length * 0.25), (int) max($length * 0.25, $length * 0.6)) : 0,
                'options' => $options,
            ];
        }
        $round = (string) Str::uuid();
        Cache::put($this->key($user, $round), ['answers' => $answers, 'given' => [], 'score' => 0], now()->addMinutes(30));

        return ['round' => $round, 'questions' => $questions];
    }

    /**
     * @return array{correct: bool, answer: int, score: int, total: int, finished: bool, best: int}|null
     */
    public function answer(User $user, string $round, int $question, int $option): ?array
    {
        $key = $this->key($user, $round);
        $state = Cache::get($key);
        if (! is_array($state) || ! array_key_exists($question, $state['answers'])) {
            return null;
        }
        $answer = $state['answers'][$question];
        $total = count($state['answers']);
        if (! array_key_exists($question, $state['given'])) {
            $state['given'][$question] = $option;
            $state['score'] += $option === $answer ? 1 : 0;
            Cache::put($key, $state, now()->addMinutes(30));
        }
        $finished = count($state['given']) === $total;
        $best = $finished ? $this->record($user, $state['score'], $total) : 0;

        return [
            'correct' => $state['given'][$question] === $answer,
            'answer' => $answer,
            'score' => $state['score'],
            'total' => $total,
            'finished' => $finished,
            'best' => $best,
        ];
    }

    /** Найкращий результат дня зберігається; повертає його. */
    private function record(User $user, int $score, int $total): int
    {
        $row = GameScore::query()->where('user_id', $user->id)->where('kind', self::KIND)->whereDate('day', today())->first();
        if ($row === null) {
            GameScore::query()->create(['user_id' => $user->id, 'kind' => self::KIND, 'day' => today(), 'score' => $score, 'total' => $total]);

            return $score;
        }
        if ($score > $row->score) {
            $row->update(['score' => $score, 'total' => $total]);
        }

        return max($score, $row->score);
    }

    private function label(Track $track): string
    {
        return $track->artist.' — '.$track->title;
    }

    private function key(User $user, string $round): string
    {
        return 'music-quiz:'.$user->id.':'.$round;
    }
}
