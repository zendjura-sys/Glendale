<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Заглушена людина: лишається в друзях, але її записи не потрапляють у стрічку.
 *
 * @property int $user_id
 * @property int $muted_id
 */
#[Fillable(['user_id', 'muted_id'])]
class UserMute extends Model {}
