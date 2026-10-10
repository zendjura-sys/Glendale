<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $plus_code_id
 * @property int $user_id
 */
#[Fillable(['plus_code_id', 'user_id'])]
class PlusCodeRedemption extends Model {}
