<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Результат міні-гри за день: вікторина (trivia) чи музичний квіз (music_quiz).
 *
 * @property int $id
 * @property int $user_id
 * @property string $kind
 * @property Carbon $day
 * @property int $score
 * @property int $total
 */
#[Fillable(['user_id', 'kind', 'day', 'score', 'total'])]
class GameScore extends Model
{
    protected function casts(): array
    {
        return ['day' => 'date'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Найкращі за сьогодні.
     *
     * @return list<array{user: array<string, mixed>, score: int, total: int}>
     */
    public static function top(string $kind, int $limit = 10): array
    {
        return array_values(self::query()->with('user')
            ->where('kind', $kind)->whereDate('day', today())
            ->orderByDesc('score')->orderBy('updated_at')
            ->limit($limit)->get()
            ->filter(fn (self $s) => $s->user !== null)
            ->map(fn (self $s) => ['user' => $s->user->toCard(), 'score' => $s->score, 'total' => $s->total])
            ->all());
    }
}
