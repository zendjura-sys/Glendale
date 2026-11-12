<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Зміна чи чергування в сім’ї. Без учасника — вільна: будь-хто може її взяти.
 *
 * @property int $id
 * @property int $family_id
 * @property string $title
 * @property string|null $note
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property int|null $member_id
 * @property int|null $created_by
 * @property-read FamilyMember|null $member
 */
#[Fillable(['family_id', 'title', 'note', 'starts_at', 'ends_at', 'member_id', 'created_by'])]
class FamilyShift extends Model
{
    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /** @return BelongsTo<FamilyMember, $this> */
    public function member(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'member_id');
    }
}
