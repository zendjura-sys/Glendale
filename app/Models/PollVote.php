<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $poll_id
 * @property int $option_id
 * @property int $user_id
 */
#[Fillable(['poll_id', 'option_id', 'user_id'])]
class PollVote extends Model
{
    //
}
