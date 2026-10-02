<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $family_id
 * @property int $item_id
 * @property int|null $member_id
 * @property string $action
 * @property int $quantity
 * @property int $quantity_after
 * @property string|null $proof_path
 * @property string|null $comment
 * @property bool $is_suspicious
 * @property Carbon $created_at
 * @property-read FamilyItem $item
 * @property-read FamilyMember|null $member
 */
#[Fillable(['family_id', 'item_id', 'member_id', 'action', 'quantity', 'quantity_after', 'proof_path', 'comment', 'is_suspicious', 'created_at'])]
class FamilyItemLog extends Model
{
    public const UPDATED_AT = null;

    public const ACTIONS = ['take' => 'Взяв', 'put' => 'Поклав', 'adjust' => 'Інвентаризація'];

    protected function casts(): array
    {
        return ['is_suspicious' => 'boolean', 'created_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<FamilyItem, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(FamilyItem::class, 'item_id');
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'member_id');
    }
}
