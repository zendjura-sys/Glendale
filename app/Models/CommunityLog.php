<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Запис журналу дій керівників спільноти: хто кого прийняв, видалив, змінив роль, правила тощо.
 *
 * @property int $id
 * @property int $community_id
 * @property int|null $actor_id
 * @property string $action
 * @property int|null $target_user_id
 * @property string|null $note
 * @property Carbon|null $created_at
 */
#[Fillable(['community_id', 'actor_id', 'action', 'target_user_id', 'note'])]
class CommunityLog extends Model
{
    public const UPDATED_AT = null;

    /** Назви дій для журналу. */
    public const LABELS = [
        'member.approve' => 'Схвалив заявку',
        'member.decline' => 'Відхилив заявку',
        'member.role' => 'Змінив роль',
        'member.title' => 'Змінив підпис ролі',
        'member.remove' => 'Видалив учасника',
        'post.approve' => 'Схвалив запис',
        'post.reject' => 'Відхилив запис',
        'post.delete' => 'Видалив запис',
        'settings.update' => 'Змінив опис і налаштування',
        'settings.rules' => 'Змінив правила й модерацію',
        'settings.access' => 'Змінив доступ',
        'settings.image' => 'Змінив аватар чи обкладинку',
    ];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /** @return BelongsTo<User, $this> */
    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public static function record(Community $community, ?User $actor, string $action, ?User $target = null, ?string $note = null): void
    {
        self::query()->create([
            'community_id' => $community->id,
            'actor_id' => $actor?->id,
            'action' => $action,
            'target_user_id' => $target?->id,
            'note' => $note === null ? null : mb_substr($note, 0, 300),
        ]);
    }
}
