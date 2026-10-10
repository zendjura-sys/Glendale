<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $community_id
 * @property int $user_id
 * @property string $role
 * @property string $status
 * @property string|null $title
 * @property string|null $color
 * @property Carbon|null $created_at
 */
#[Fillable(['community_id', 'user_id', 'role', 'status', 'title', 'color'])]
class CommunityMember extends Model
{
    public const ROLE_OWNER = 'owner';

    public const ROLE_ADMIN = 'admin';

    public const ROLE_EDITOR = 'editor';

    public const ROLE_MEMBER = 'member';

    public const MANAGER_ROLES = [self::ROLE_OWNER, self::ROLE_ADMIN, self::ROLE_EDITOR];

    public const STATUS_ACTIVE = 'active';

    public const STATUS_PENDING = 'pending';

    /** Кольори підпису ролі (ключі палітри, не hex). */
    public const COLORS = ['indigo', 'sky', 'emerald', 'amber', 'rose', 'violet'];

    /**
     * @return BelongsTo<Community, $this>
     */
    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /** Редактор і вище: публікації від імені спільноти, модерація стіни. */
    public function isManager(): bool
    {
        return $this->isActive() && in_array($this->role, self::MANAGER_ROLES, true);
    }

    /** Адміністратор і власник: налаштування й учасники. */
    public function isAdmin(): bool
    {
        return $this->isActive() && in_array($this->role, [self::ROLE_OWNER, self::ROLE_ADMIN], true);
    }
}
