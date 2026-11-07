<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Спроба, яку зупинив антиспам (флуд, повтори, заборонений домен, бан IP…). Зберігаємо 30 днів.
 *
 * @property int $id
 * @property string $kind
 * @property int|null $user_id
 * @property int|null $conversation_id
 * @property string|null $ip_hash
 * @property string|null $detail
 * @property CarbonInterface $created_at
 */
class SpamBlock extends Model
{
    use Prunable;

    public const UPDATED_AT = null;

    public const KINDS = [
        'flood' => 'Флуд',
        'repeat' => 'Повтори',
        'new_link' => 'Посилання новачка',
        'domain' => 'Заборонений домен',
        'ip_ban' => 'Бан IP',
        'guest_ban' => 'Бан гостя',
        'group_rule' => 'Правила групи',
        'profanity' => 'Мат',
    ];

    protected $fillable = ['kind', 'user_id', 'conversation_id', 'ip_hash', 'detail', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function prunable(): mixed
    {
        return static::query()->where('created_at', '<', now()->subDays(30));
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
