<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $conversation_id
 * @property int|null $user_id
 * @property string $type
 * @property string|null $body
 * @property int|null $reply_to_id
 * @property array<string, mixed>|null $meta
 * @property Carbon|null $edited_at
 * @property Carbon|null $publish_at
 * @property Carbon|null $expires_at
 * @property Carbon $created_at
 */
#[Fillable(['conversation_id', 'user_id', 'type', 'body', 'reply_to_id', 'meta', 'edited_at', 'publish_at', 'expires_at'])]
class Message extends Model
{
    use SoftDeletes;

    public const TYPE_TEXT = 'text';

    public const TYPE_SYSTEM = 'system';

    public const TYPE_STICKER = 'sticker';

    public const TYPE_VOICE = 'voice';

    public const TYPE_CONTACT = 'contact';

    public const EDIT_WINDOW_HOURS = 24;

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'edited_at' => 'datetime',
            'publish_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'reply_to_id')->withTrashed();
    }

    /**
     * @return HasMany<MessageAttachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class)->orderBy('position');
    }

    public function isEditableBy(User $user): bool
    {
        return $this->type === self::TYPE_TEXT
            && $this->user_id === $user->id
            && $this->created_at->gt(now()->subHours(self::EDIT_WINDOW_HOURS));
    }
}
