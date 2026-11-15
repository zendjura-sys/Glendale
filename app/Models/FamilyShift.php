<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Зміна чи чергування в сім’ї. Без учасника — вільна: будь-хто може її взяти.
 * Хто взяв зміну — бригадир; інші можуть проситися в напарники, бригадир їх схвалює.
 *
 * @property int $id
 * @property int $family_id
 * @property string $title
 * @property string|null $note
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property int|null $member_id
 * @property int|null $created_by
 * @property array{type: string, tier: string|null, count: int}|null $goal
 * @property int $progress
 * @property Carbon|null $completed_at
 * @property-read FamilyMember|null $member
 * @property-read Collection<int, FamilyShiftPartner> $partners
 */
#[Fillable(['family_id', 'title', 'note', 'goal', 'progress', 'completed_at', 'starts_at', 'ends_at', 'member_id', 'created_by'])]
class FamilyShift extends Model
{
    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'goal' => 'array', 'completed_at' => 'datetime'];
    }

    /** @return BelongsTo<FamilyMember, $this> */
    public function member(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'member_id');
    }

    /** @return HasMany<FamilyShiftPartner, $this> */
    public function partners(): HasMany
    {
        return $this->hasMany(FamilyShiftPartner::class, 'shift_id')->orderBy('id');
    }
}
