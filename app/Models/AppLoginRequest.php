<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Запит браузера «Увійти через застосунок GameCon»: pending → approved → (consumed) | denied.
 * Прострочений — той, що досі pending після expires_at.
 *
 * @property string $id
 * @property int|null $user_id той, хто підтвердив або відхилив у застосунку
 * @property string|null $login_hint логін або пошта, які браузер указав для push
 * @property string $secret_hash sha256 секрету, який знає лише браузер
 * @property string $code 2 цифри, які браузер показує, а людина вибирає в застосунку
 * @property string $status pending | approved | denied
 * @property string|null $ip
 * @property string|null $user_agent
 * @property string|null $country
 * @property string|null $city
 * @property Carbon|null $approved_at
 * @property Carbon|null $consumed_at
 * @property Carbon $expires_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'login_hint', 'secret_hash', 'code', 'status', 'ip', 'user_agent', 'country', 'city', 'approved_at', 'consumed_at', 'expires_at'])]
class AppLoginRequest extends Model
{
    use HasUuids, MassPrunable;

    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const DENIED = 'denied';

    /** Скільки днів тримати рядки для аудиту. */
    public const KEEP_DAYS = 30;

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'consumed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDays(self::KEEP_DAYS));
    }

    public function isExpired(): bool
    {
        return $this->status === self::PENDING && $this->expires_at->isPast();
    }
}
