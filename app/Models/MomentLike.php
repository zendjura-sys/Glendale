<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $moment_id
 * @property int $user_id
 */
#[Fillable(['moment_id', 'user_id'])]
class MomentLike extends Model
{
    public const UPDATED_AT = null;
}
