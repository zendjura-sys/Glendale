<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Тема обговорення: до предмета (фільм, гра, сервер, сім’я…) чи загальна — за категорією.
 *
 * @property int $id
 * @property string|null $subject_type
 * @property int|null $subject_id
 * @property string $category
 * @property int $user_id
 * @property string $title
 * @property string|null $body
 * @property array<int, mixed>|null $embeds
 * @property bool $spoiler
 * @property bool $is_pinned
 * @property bool $is_locked
 * @property int $replies_count
 * @property int $likes_count
 * @property int $views_count
 * @property Carbon|null $last_reply_at
 * @property Carbon $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $user
 */
#[Fillable(['subject_type', 'subject_id', 'category', 'user_id', 'title', 'body', 'embeds', 'spoiler', 'is_pinned', 'is_locked', 'last_reply_at'])]
class Discussion extends Model
{
    use SoftDeletes;

    /** Категорії загального розділу «Обговорення». */
    public const CATEGORIES = [
        'general' => 'Загальне',
        'cinema' => 'Кіно',
        'series' => 'Серіали',
        'anime' => 'Аніме',
        'games' => 'Ігри',
        'music' => 'Музика',
        'tech' => 'Техніка й ПК',
    ];

    protected function casts(): array
    {
        return [
            'spoiler' => 'boolean',
            'embeds' => 'array',
            'is_pinned' => 'boolean',
            'is_locked' => 'boolean',
            'last_reply_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<DiscussionReply, $this> */
    public function replies(): HasMany
    {
        return $this->hasMany(DiscussionReply::class);
    }
}
