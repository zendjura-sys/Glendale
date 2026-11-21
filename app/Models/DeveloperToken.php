<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Токен доступу застосунку розробника (і його refresh-токен). Значення — лише SHA-256.
 *
 * @property int $id
 * @property int $developer_app_id
 * @property int $user_id
 * @property string $access_token
 * @property string|null $refresh_token
 * @property list<string> $scopes
 * @property Carbon $expires_at
 * @property Carbon|null $refresh_expires_at
 * @property Carbon|null $revoked_at
 * @property Carbon|null $last_used_at
 * @property Carbon|null $created_at
 * @property-read DeveloperApp $app
 * @property-read User $user
 */
class DeveloperToken extends Model
{
    protected $fillable = ['developer_app_id', 'user_id', 'access_token', 'refresh_token', 'scopes', 'expires_at', 'refresh_expires_at', 'revoked_at', 'last_used_at'];

    protected $hidden = ['access_token', 'refresh_token'];

    protected function casts(): array
    {
        return [
            'scopes' => 'array',
            'expires_at' => 'datetime',
            'refresh_expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'last_used_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<DeveloperApp, $this> */
    public function app(): BelongsTo
    {
        return $this->belongsTo(DeveloperApp::class, 'developer_app_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function can(string $scope): bool
    {
        return in_array($scope, $this->scopes, true);
    }
}
