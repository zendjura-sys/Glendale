<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Оскарження рішення модерації: блокування, заглушення або видалений вміст.
 *
 * @property int $id
 * @property int $user_id
 * @property string $kind
 * @property string $body
 * @property string $status
 * @property string|null $reply
 * @property int|null $handled_by
 * @property Carbon $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'kind', 'body', 'status', 'reply', 'handled_by'])]
class Appeal extends Model
{
    public const KINDS = [
        'ban' => 'Блокування акаунта',
        'mute' => 'Заборона писати',
        'content' => 'Видалений запис чи повідомлення',
        'other' => 'Інше рішення',
    ];

    public const PENDING = 'pending';

    public const ACCEPTED = 'accepted';

    public const REJECTED = 'rejected';

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
