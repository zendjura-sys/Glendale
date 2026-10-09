<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Відповідь на подію гри: «піду / дивитимусь» чи «не піду».
 *
 * @property int $game_event_id
 * @property int $user_id
 * @property string $status
 */
#[Fillable(['game_event_id', 'user_id', 'status'])]
class GameEventRsvp extends Model
{
    public const GOING = 'going';

    public const DECLINED = 'declined';

    public $timestamps = false;
}
