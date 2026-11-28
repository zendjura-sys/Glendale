<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Отримана нагорода сезонного пропуску.
 *
 * @property int $id
 * @property int $user_id
 * @property string $season Y-m
 * @property int $level
 * @property string $track free | plus
 * @property string $type
 * @property string $value
 * @property int $xp
 */
#[Fillable(['user_id', 'season', 'level', 'track', 'type', 'value', 'xp'])]
class SeasonPassClaim extends Model
{
    public const UPDATED_AT = null;
}
