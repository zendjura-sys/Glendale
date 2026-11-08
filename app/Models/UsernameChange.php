<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Зміна ніка (адреси сторінки).
 *
 * @property int $id
 * @property int $user_id
 * @property string $old_username
 * @property string $new_username
 * @property Carbon $created_at
 */
class UsernameChange extends Model
{
    public const UPDATED_AT = null;

    /** Скільки днів старий нік не може зайняти хтось інший (захист від підміни). */
    public const HOLD_DAYS = 30;

    protected $fillable = ['user_id', 'old_username', 'new_username'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Нік нещодавно звільнив інший користувач — поки що не можна зайняти. */
    public static function held(string $username, ?int $exceptUserId = null): bool
    {
        return static::query()
            ->where('old_username', mb_strtolower($username))
            ->where('created_at', '>=', now()->subDays(self::HOLD_DAYS))
            ->when($exceptUserId !== null, fn ($q) => $q->where('user_id', '!=', $exceptUserId))
            ->exists();
    }
}
