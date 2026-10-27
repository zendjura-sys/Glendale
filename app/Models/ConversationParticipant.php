<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $conversation_id
 * @property int $user_id
 * @property string $role
 * @property int|null $last_read_message_id
 * @property bool $is_muted
 * @property Carbon|null $joined_at
 * @property Carbon|null $left_at
 * @property Carbon|null $timeout_until Тайм-аут: читати можна, писати ні
 * @property Carbon|null $banned_until Виключено на час: повернутися не можна до цієї дати
 * @property string|null $background Особистий фон чату
 */
#[Fillable(['conversation_id', 'user_id', 'role', 'last_read_message_id', 'is_muted', 'pinned_at', 'folder', 'marked_unread', 'share_receipts', 'joined_at', 'left_at', 'timeout_until', 'banned_until', 'background'])]
class ConversationParticipant extends Model
{
    public const ROLE_OWNER = 'owner';

    public const ROLE_ADMIN = 'admin';

    public const ROLE_MEMBER = 'member';

    protected function casts(): array
    {
        return [
            'is_muted' => 'boolean',
            'marked_unread' => 'boolean',
            'share_receipts' => 'boolean',
            'pinned_at' => 'datetime',
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
            'timeout_until' => 'datetime',
            'banned_until' => 'datetime',
        ];
    }

    public function timedOut(): bool
    {
        return $this->timeout_until !== null && $this->timeout_until->isFuture();
    }

    public function banned(): bool
    {
        return $this->banned_until !== null && $this->banned_until->isFuture();
    }

    public function canManage(): bool
    {
        return in_array($this->role, [self::ROLE_OWNER, self::ROLE_ADMIN], true);
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
}
