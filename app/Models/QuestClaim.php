<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $user_id
 * @property string $quest
 * @property string $day Y-m-d
 * @property string $season Y-m
 * @property int $xp
 */
#[Fillable(['user_id', 'quest', 'day', 'season', 'xp'])]
class QuestClaim extends Model
{
    public const UPDATED_AT = null;
}
