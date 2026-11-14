<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Застосунок стороннього розробника (OAuth-клієнт).
 *
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string|null $description
 * @property string|null $website
 * @property string $client_id
 * @property string|null $client_secret SHA-256 секрету
 * @property string $public_key
 * @property string|null $bot_token SHA-256 токена бота
 * @property Carbon|null $bot_token_at
 * @property bool $confidential
 * @property list<string> $redirect_uris
 * @property list<string> $scopes
 * @property Carbon|null $blocked_at
 * @property string|null $blocked_reason
 * @property Carbon|null $created_at
 * @property-read User $user
 */
class DeveloperApp extends Model
{
    /** Скільки застосунків може мати одна людина. */
    public const MAX_PER_USER = 10;

    protected $fillable = ['user_id', 'name', 'description', 'website', 'client_id', 'client_secret', 'public_key', 'bot_token', 'bot_token_at', 'confidential', 'redirect_uris', 'scopes', 'blocked_at', 'blocked_reason'];

    protected $hidden = ['client_secret', 'bot_token'];

    protected function casts(): array
    {
        return [
            'confidential' => 'boolean',
            'redirect_uris' => 'array',
            'scopes' => 'array',
            'blocked_at' => 'datetime',
            'bot_token_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<DeveloperToken, $this> */
    public function tokens(): HasMany
    {
        return $this->hasMany(DeveloperToken::class);
    }

    public function blocked(): bool
    {
        return $this->blocked_at !== null;
    }
}
