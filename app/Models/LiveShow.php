<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Шоу наживо: аудіокімната LiveKit «show-{id}» з ведучими, гостями на таймері й слухачами.
 *
 * @property int $id
 * @property int $host_id
 * @property string $title
 * @property string|null $topic
 * @property list<string>|null $topics
 * @property string $format duo | double | custom
 * @property int $stage_seats місць на сцені (ведучі й співведучі)
 * @property int $guest_seats скільки гостей можуть питати одночасно
 * @property int $question_seconds скільки триває питання гостя
 * @property string $status scheduled | live | ended
 * @property Carbon|null $scheduled_at
 * @property Carbon|null $started_at
 * @property Carbon|null $ended_at
 * @property int $peak_listeners
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable(['host_id', 'title', 'topic', 'topics', 'format', 'stage_seats', 'guest_seats', 'question_seconds', 'status', 'scheduled_at', 'started_at', 'ended_at', 'peak_listeners'])]
class LiveShow extends Model
{
    public const SCHEDULED = 'scheduled';

    public const LIVE = 'live';

    public const ENDED = 'ended';

    /** Формати: місця на сцені й для гостей. Власний — задає ведучий. */
    public const FORMATS = [
        'duo' => ['stage' => 2, 'guests' => 1],
        'double' => ['stage' => 4, 'guests' => 2],
        'custom' => ['stage' => 4, 'guests' => 1],
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['topics' => 'array', 'scheduled_at' => 'datetime', 'started_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    /** Скільки тем можна дати кімнаті. */
    public const MAX_TOPICS = 5;

    /**
     * Теми кімнати; у старих записів — одна з колонки topic.
     *
     * @return list<string>
     */
    public function topicList(): array
    {
        $topics = is_array($this->topics) ? $this->topics : ($this->topic ? [$this->topic] : []);

        return array_values(array_filter($topics, 'is_string'));
    }

    /** @return BelongsTo<User, $this> */
    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    /** @return HasMany<LiveShowMember, $this> */
    public function members(): HasMany
    {
        return $this->hasMany(LiveShowMember::class);
    }

    public function livekitName(): string
    {
        return 'show-'.$this->id;
    }
}
