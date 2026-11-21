<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Закріплене повідомлення бесіди (їх може бути кілька).
 *
 * @property int $id
 * @property int $conversation_id
 * @property int $message_id
 * @property int|null $user_id
 * @property-read Message|null $message
 */
#[Fillable(['conversation_id', 'message_id', 'user_id'])]
class MessagePin extends Model
{
    /** Скільки повідомлень можна закріпити в одній бесіді. */
    public const MAX = 10;

    /** @return BelongsTo<Message, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}
