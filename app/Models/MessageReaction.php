<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Реакція на повідомлення: одна на людину (нова замінює попередню).
 *
 * @property int $message_id
 * @property int $user_id
 * @property string $emoji
 * @property Carbon|null $created_at
 */
#[Fillable(['message_id', 'user_id', 'emoji', 'created_at'])]
class MessageReaction extends Model
{
    /** Набір реакцій у чатах. */
    public const EMOJI = ['👍', '❤️', '🔥', '😂', '😮', '😢', '🎉', '👎'];

    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = null;

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
