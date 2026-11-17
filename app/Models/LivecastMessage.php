<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Повідомлення, подарунок або донат у чаті LiveCast.
 *
 * @property int $id
 * @property int $livecast_id
 * @property int $user_id
 * @property string $kind chat | gift | donation
 * @property string|null $gift_key
 * @property array<string, mixed>|null $meta
 * @property string $body
 */
#[Fillable(['livecast_id', 'user_id', 'kind', 'gift_key', 'meta', 'body'])]
class LivecastMessage extends Model
{
    public const CHAT = 'chat';

    public const GIFT = 'gift';

    public const DONATION = 'donation';

    protected $table = 'livecast_messages';

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['meta' => 'array'];
    }

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
