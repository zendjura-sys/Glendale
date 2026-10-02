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
 * @property string $type
 * @property int $submitter_id
 * @property int $beneficiary_id
 * @property Carbon $event_date
 * @property array<string, mixed>|null $data
 * @property string|null $description
 * @property string $status
 * @property int $reward
 * @property int $points
 * @property array<string, mixed>|null $flags
 * @property int|null $reviewed_by
 * @property Carbon|null $reviewed_at
 * @property string|null $review_comment
 * @property Carbon $created_at
 * @property-read FamilyMember $submitter
 * @property-read FamilyMember $beneficiary
 * @property-read FamilyMember|null $reviewer
 */
#[Fillable(['family_id', 'type', 'submitter_id', 'beneficiary_id', 'event_date', 'data', 'description', 'status', 'reward', 'points', 'flags'])]
class FamilyReport extends Model
{
    public const TYPE_BIZWAR = 'bizwar';

    public const TYPE_CONTRACT = 'contract';

    public const TYPE_INVESTMENT = 'investment';

    public const TYPE_OTHER = 'other';

    public const TYPES = [
        self::TYPE_BIZWAR => 'Бізвар',
        self::TYPE_CONTRACT => 'Контракти',
        self::TYPE_INVESTMENT => 'Інвестиції',
        self::TYPE_OTHER => 'Інше',
    ];

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const TIERS = ['light' => 'Легкий', 'medium' => 'Середній', 'heavy' => 'Важкий'];

    /** Години стріл, які можна відмітити у звіті «Бізвар». */
    public const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'data' => 'array',
            'flags' => 'array',
            'reviewed_at' => 'datetime',
            'reward' => 'integer',
            'points' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Family, $this>
     */
    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'submitter_id');
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'beneficiary_id');
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'reviewed_by');
    }

    /**
     * @return HasMany<FamilyReportProof, $this>
     */
    public function proofs(): HasMany
    {
        return $this->hasMany(FamilyReportProof::class, 'report_id');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function permission(): string
    {
        return 'reports.'.$this->type;
    }
}
