<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Розсилка від адміністрації: сповіщення в дзвіночок (і push) для обраної аудиторії.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $title
 * @property string $body
 * @property string|null $url
 * @property string $audience all|plus|app|staff
 * @property int $sent_count
 * @property Carbon|null $finished_at
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'title', 'body', 'url', 'audience', 'sent_count', 'finished_at'])]
class Broadcast extends Model
{
    public const AUDIENCES = ['all', 'plus', 'app', 'staff'];

    protected function casts(): array
    {
        return ['finished_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
