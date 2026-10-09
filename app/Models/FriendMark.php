<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Приватна позначка друга: список, своє ім’я і нотатка. Бачить лише власник.
 *
 * @property int $user_id
 * @property int $friend_id
 * @property string|null $list
 * @property string|null $nickname
 * @property string|null $note
 */
#[Fillable(['user_id', 'friend_id', 'list', 'nickname', 'note'])]
class FriendMark extends Model
{
    public const LISTS = ['raid', 'cinema', 'work'];
}
