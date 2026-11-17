<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Подарунок у інвентарі людини (випав із пака).
 *
 * @property int $id
 * @property int $user_id
 * @property int $gc_gift_id
 * @property int|null $gc_gift_pack_id
 * @property string $status ready | gifted
 * @property Carbon $opened_at
 * @property Carbon|null $gifted_at
 */
#[Fillable(['user_id', 'gc_gift_id', 'gc_gift_pack_id', 'status', 'opened_at', 'gifted_at'])]
class UserGcGift extends Model
{
    public const READY = 'ready';

    public const GIFTED = 'gifted';

    protected $table = 'user_gc_gifts';

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['opened_at' => 'datetime', 'gifted_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<GcGift, $this> */
    public function gift(): BelongsTo
    {
        return $this->belongsTo(GcGift::class, 'gc_gift_id');
    }

    /** @return BelongsTo<GcGiftPack, $this> */
    public function pack(): BelongsTo
    {
        return $this->belongsTo(GcGiftPack::class, 'gc_gift_pack_id');
    }

    /** @return array<string, mixed> */
    public function toCard(): array
    {
        $this->loadMissing('gift');

        return [
            'id' => $this->id,
            'status' => $this->status,
            'opened_at' => $this->opened_at?->toIso8601String(),
            'gift' => $this->gift?->toCard(),
        ];
    }
}
