<?php

namespace Addons\TelegramBot\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelegramApplication extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'telegram_applications';

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'chat_id', 'telegram_username', 'user_id', 'nickname', 'age_range',
        'playtime', 'experience', 'direction', 'about', 'status',
        'reviewed_by', 'reviewed_at', 'review_note', 'invite_link', 'joined_at',
        'notified_messages',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime', 'joined_at' => 'datetime', 'notified_messages' => 'array'];
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    /**
     * Последняя одобренная заявка этого чата — по ней бот решает,
     * впускать ли человека в группу, когда придёт chat_join_request.
     */
    public static function approvedFor(string $chatId): ?self
    {
        return self::query()
            ->where('chat_id', $chatId)
            ->where('status', self::STATUS_APPROVED)
            ->latest('id')
            ->first();
    }

    /** Заявка, которая сейчас определяет статус чата: на рассмотрении или одобренная. */
    public static function currentFor(string $chatId): ?self
    {
        return self::query()
            ->where('chat_id', $chatId)
            ->whereIn('status', [self::STATUS_PENDING, self::STATUS_APPROVED])
            ->latest('id')
            ->first();
    }

    /**
     * Одна заявка на рассмотрении на чат: иначе нажатие «Подати заявку»
     * дважды заводит дубли, и админам прилетает одно и то же по два раза.
     */
    public static function pendingFor(string $chatId): ?self
    {
        return self::query()
            ->where('chat_id', $chatId)
            ->where('status', self::STATUS_PENDING)
            ->latest('id')
            ->first();
    }
}
