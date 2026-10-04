<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Скарга на повідомлення в чаті.
 *
 * @property int $id
 * @property int $message_id
 * @property int $reporter_id
 * @property string $reason
 * @property string|null $comment
 * @property string $status
 * @property int|null $resolved_by
 * @property string|null $resolution
 * @property Carbon $created_at
 * @property-read Message|null $message
 * @property-read User|null $reporter
 */
#[Fillable(['message_id', 'reporter_id', 'reason', 'comment', 'status', 'resolved_by', 'resolution'])]
class MessageReport extends Model
{
    public const REASONS = [
        'spam' => 'Спам або реклама',
        'abuse' => 'Образи, мат, цькування',
        'scam' => 'Шахрайство',
        'other' => 'Інше',
    ];

    public const PENDING = 'pending';

    public const RESOLVED = 'resolved';

    public const DISMISSED = 'dismissed';

    /**
     * @return BelongsTo<Message, $this>
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }
}
