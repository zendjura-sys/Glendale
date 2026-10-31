<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Косметика в інвентарі людини (рамка, колір ніку, значок, ефект шапки, набір стікерів).
 *
 * @property int $id
 * @property int $user_id
 * @property string $type
 * @property string $value
 * @property string|null $source Звідки: season:Y-m
 */
#[Fillable(['user_id', 'type', 'value', 'source'])]
class UserCosmetic extends Model
{
    public const UPDATED_AT = null;
}
