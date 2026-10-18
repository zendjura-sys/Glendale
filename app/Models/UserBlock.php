<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Власник обмежив, скільки інша людина бачить на його сторінці.
 *
 * @property int $user_id
 * @property int $blocked_id
 */
#[Fillable(['user_id', 'blocked_id'])]
class UserBlock extends Model
{
    public static function between(User $owner, User $viewer): bool
    {
        return self::query()->where('user_id', $owner->id)->where('blocked_id', $viewer->id)->exists();
    }

    public static function either(User $a, User $b): bool
    {
        return self::between($a, $b) || self::between($b, $a);
    }
}
