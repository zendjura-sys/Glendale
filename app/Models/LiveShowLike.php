<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Лайк людині на сцені / гостю в живому GameCast.
 *
 * @property int $id
 * @property int $live_show_id
 * @property int $from_user_id
 * @property int $to_user_id
 */
#[Fillable(['live_show_id', 'from_user_id', 'to_user_id'])]
class LiveShowLike extends Model
{
    protected $table = 'live_show_likes';

    /** @return BelongsTo<LiveShow, $this> */
    public function show(): BelongsTo
    {
        return $this->belongsTo(LiveShow::class, 'live_show_id');
    }
}
