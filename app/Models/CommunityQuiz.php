<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Жива вікторина спільноти (№225).
 *
 * @property int $id
 * @property int $community_id
 * @property int $host_id
 * @property string $title
 * @property list<array{q: string, options: list<string>, answer: int}> $questions
 * @property int $seconds
 * @property string $phase draft | question | reveal | done
 * @property int $current
 * @property Carbon|null $phase_at
 * @property-read Community $community
 */
#[Fillable(['community_id', 'host_id', 'title', 'questions', 'seconds', 'phase', 'current', 'phase_at'])]
class CommunityQuiz extends Model
{
    public const DRAFT = 'draft';

    public const QUESTION = 'question';

    public const REVEAL = 'reveal';

    public const DONE = 'done';

    /** Живі (йдуть зараз) — для «Зараз» у лобі. */
    public const LIVE = [self::QUESTION, self::REVEAL];

    protected function casts(): array
    {
        return ['questions' => 'array', 'phase_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<Community, $this>
     */
    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    /**
     * @return HasMany<CommunityQuizAnswer, $this>
     */
    public function answers(): HasMany
    {
        return $this->hasMany(CommunityQuizAnswer::class);
    }
}
