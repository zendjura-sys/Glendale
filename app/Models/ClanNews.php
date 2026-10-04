<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Новина клану.
 *
 * @property int $id
 * @property int $clan_id
 * @property int|null $user_id
 * @property string $title
 * @property string $body
 * @property bool $is_pinned
 * @property Carbon $created_at
 */
#[Fillable(['clan_id', 'user_id', 'title', 'body', 'is_pinned'])]
class ClanNews extends Model
{
    protected $table = 'clan_news';

    protected function casts(): array
    {
        return ['is_pinned' => 'boolean'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
