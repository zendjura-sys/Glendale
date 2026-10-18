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
class Save extends Model
{
    public const POST = 'post';

    public const MOVIE = 'movie';

    public const GAME = 'game';

    public const SERVER = 'server';

    public const KINDS = [self::POST, self::MOVIE, self::GAME, self::SERVER];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
