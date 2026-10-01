<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $family_id
 * @property int $member_id
 * @property int $amount
 * @property string $status
 * @property string|null $note
 * @property int|null $processed_by
 * @property Carbon|null $processed_at
 * @property string|null $proof_path
 * @property string|null $process_comment
 * @property Carbon $created_at
 * @property-read FamilyMember $member
 * @property-read FamilyMember|null $processor
 */
#[Fillable(['family_id', 'member_id', 'amount', 'status', 'note', 'processed_by', 'processed_at', 'proof_path', 'process_comment'])]
class FamilyCashout extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    public const STATUS_CANCELLED = 'cancelled';

    protected function casts(): array
    {
        return ['amount' => 'integer', 'processed_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'member_id');
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function processor(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'processed_by');
    }
}
