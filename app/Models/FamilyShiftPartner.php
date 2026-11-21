<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Напарник на зміні. Заявку схвалює бригадир (той, хто взяв зміну першим) або керівництво.
 * Завдання зміни напарник виконує сам за себе: свій прогрес і своє зарахування.
 *
 * @property int $id
 * @property int $shift_id
 * @property int $member_id
 * @property string $status
 * @property Carbon|null $approved_at
 * @property int $progress
 * @property Carbon|null $completed_at
 * @property-read FamilyMember|null $member
 * @property-read FamilyShift|null $shift
 */
#[Fillable(['shift_id', 'member_id', 'status', 'approved_at', 'progress', 'completed_at'])]
class FamilyShiftPartner extends Model
{
    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    /** Скільки напарників може бути на одній зміні. */
    public const LIMIT = 5;

    protected function casts(): array
    {
        return ['approved_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    /** @return BelongsTo<FamilyMember, $this> */
    public function member(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'member_id');
    }

    /** @return BelongsTo<FamilyShift, $this> */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(FamilyShift::class, 'shift_id');
    }
}
