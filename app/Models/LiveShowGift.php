<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Подарунок у ефірі GameCast (від глядача ведучому / гостю).
 *
 * @property int $id
 * @property int $live_show_id
 * @property int $from_user_id
 * @property int $to_user_id
 * @property int $gc_gift_id
 * @property int|null $user_gc_gift_id
 */
#[Fillable(['live_show_id', 'from_user_id', 'to_user_id', 'gc_gift_id', 'user_gc_gift_id'])]
class LiveShowGift extends Model
{
    protected $table = 'live_show_gifts';

    /** @return BelongsTo<LiveShow, $this> */
    public function show(): BelongsTo
    {
        return $this->belongsTo(LiveShow::class, 'live_show_id');
    }

    /** @return BelongsTo<User, $this> */
    public function from(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    /** @return BelongsTo<User, $this> */
    public function to(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    /** @return BelongsTo<GcGift, $this> */
    public function gift(): BelongsTo
    {
        return $this->belongsTo(GcGift::class, 'gc_gift_id');
    }

    /** @return array<string, mixed> */
    public function toCard(): array
    {
        $this->loadMissing(['from', 'to', 'gift']);

        return [
            'id' => $this->id,
            'from' => $this->from?->toCard(),
            'to' => $this->to?->toCard(),
            'gift' => $this->gift?->toCard(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
