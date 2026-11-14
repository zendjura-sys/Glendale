<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Хто в групі може відкривати кімнати «Слухати разом». Немає запису — можуть усі учасники.
 *
 * @property int $id
 * @property string $group_type
 * @property int $group_id
 * @property string $who all | admins | off
 */
#[Fillable(['group_type', 'group_id', 'who'])]
class ListenRoomPolicy extends Model
{
    public const WHO = ['all' => 'Усі учасники', 'admins' => 'Лише адміністратори', 'off' => 'Вимкнено'];
}
