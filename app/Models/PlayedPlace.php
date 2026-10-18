<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $user_id
 * @property string $kind
 * @property int $subject_id
 */
#[Fillable(['user_id', 'kind', 'subject_id'])]
class PlayedPlace extends Model
{
    public const SERVER = 'server';

    public const GAME = 'game';
}
