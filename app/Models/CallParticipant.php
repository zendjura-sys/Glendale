<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Учасник дзвінка: запрошений (дзвонить), у розмові, відхилив або вийшов.
 *
 * @property int $call_id
 * @property int $user_id
 * @property string $state
 * @property Carbon|null $joined_at
 * @property Carbon|null $left_at
 */
#[Fillable(['call_id', 'user_id', 'state', 'joined_at', 'left_at'])]
class CallParticipant extends Model
{
    public const STATE_INVITED = 'invited';

    public const STATE_JOINED = 'joined';

    public const STATE_DECLINED = 'declined';

    public const STATE_LEFT = 'left';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Call, $this>
     */
    public function call(): BelongsTo
    {
        return $this->belongsTo(Call::class);
    }
}
