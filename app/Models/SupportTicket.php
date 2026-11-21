<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string $category
 * @property string $subject
 * @property string $status open | answered | closed
 * @property string $priority low | normal | high | urgent
 * @property int|null $assignee_id
 * @property string|null $url
 * @property bool $unread_user
 * @property bool $unread_staff
 * @property int|null $rating
 * @property string|null $rating_comment
 * @property Carbon|null $last_reply_at
 * @property Carbon|null $first_response_at
 * @property Carbon|null $closed_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User $user
 * @property-read User|null $assignee
 */
#[Fillable(['user_id', 'category', 'subject', 'status', 'priority', 'assignee_id', 'url', 'unread_user', 'unread_staff', 'rating', 'rating_comment', 'last_reply_at', 'first_response_at', 'closed_at'])]
class SupportTicket extends Model
{
    public const CATEGORIES = [
        'account' => 'Акаунт і вхід',
        'payment' => 'Оплата й GameCon+',
        'bug' => 'Помилка на сайті чи в застосунку',
        'abuse' => 'Скарга на людину чи вміст',
        'content' => 'Спільноти, музика, кіно',
        'other' => 'Інше',
    ];

    public const STATUSES = ['open', 'answered', 'closed'];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    /** Відповіли — а людина мовчить: звернення закривається саме. */
    public const AUTO_CLOSE_DAYS = 7;

    protected function casts(): array
    {
        return [
            'unread_user' => 'boolean',
            'unread_staff' => 'boolean',
            'last_reply_at' => 'datetime',
            'first_response_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    /**
     * @return HasMany<SupportMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'ticket_id')->orderBy('id');
    }
}
