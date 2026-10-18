<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Запис, який людина прибрала зі стрічки кнопкою «Не цікаво».
 *
 * @property int $user_id
 * @property int $post_id
 * @property int $author_id
 */
#[Fillable(['user_id', 'post_id', 'author_id'])]
class PostHide extends Model {}
