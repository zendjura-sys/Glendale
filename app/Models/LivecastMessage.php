<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Повідомлення або подарунок у чаті LiveCast.
 *
 * @property int $id
 * @property int $livecast_id
 * @property int $user_id
 * @property string $kind chat | gift
 * @property string|null $gift_key
 * @property string $body
 */
#[Fillable(['livecast_id', 'user_id', 'kind', 'gift_key', 'body'])]
class LivecastMessage extends Model
{
    public const CHAT = 'chat';

    public const GIFT = 'gift';

    protected $table = 'livecast_messages';

    /** @return BelongsTo<Livecast, $this> */
    public function livecast(): BelongsTo
    {
        return $this->belongsTo(Livecast::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
