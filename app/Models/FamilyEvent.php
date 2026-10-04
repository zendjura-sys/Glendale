<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $family_id
 * @property int|null $created_by
 * @property string $title
 * @property string $type
 * @property string|null $description
 * @property Carbon $starts_at
 * @property int $points
 * @property int $reward
 * @property string $status
 * @property Carbon|null $reminded_at
 * @property-read FamilyMember|null $creator
 */
#[Fillable(['family_id', 'created_by', 'title', 'type', 'description', 'starts_at', 'points', 'reward', 'status', 'reminded_at'])]
class FamilyEvent extends Model
{
    public const TYPES = [
        'meeting' => 'Збори',
        'bizwar' => 'Бізвар',
        'training' => 'Тренування',
        'party' => 'Тусовка',
        'other' => 'Інше',
    ];

    public const STATUS_PLANNED = 'planned';

    public const STATUS_DONE = 'done';

    public const STATUS_CANCELLED = 'cancelled';

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'reminded_at' => 'datetime', 'points' => 'integer', 'reward' => 'integer'];
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'created_by');
    }

    /**
     * @return HasMany<FamilyEventAttendance, $this>
     */
    public function attendance(): HasMany
    {
        return $this->hasMany(FamilyEventAttendance::class, 'event_id');
    }
}
