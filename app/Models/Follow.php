<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $kind
 * @property int $subject_id
 */
#[Fillable(['user_id', 'kind', 'subject_id'])]
class Follow extends Model
{
    public const GAME = 'game';

    public const SERVER = 'server';

    public const KINDS = [self::GAME, self::SERVER];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
