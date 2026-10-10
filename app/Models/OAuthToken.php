<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $oauth_client_id
 * @property int $user_id
 * @property string $token_hash
 * @property list<string> $scopes
 * @property Carbon $expires_at
 * @property Carbon|null $revoked_at
 * @property Carbon|null $last_used_at
 * @property Carbon $created_at
 * @property-read OAuthClient $client
 * @property-read User $user
 */
#[Fillable(['oauth_client_id', 'user_id', 'token_hash', 'scopes', 'expires_at', 'revoked_at', 'last_used_at'])]
class OAuthToken extends Model
{
    protected $table = 'oauth_tokens';

    protected function casts(): array
    {
        return ['scopes' => 'array', 'expires_at' => 'datetime', 'revoked_at' => 'datetime', 'last_used_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<OAuthClient, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(OAuthClient::class, 'oauth_client_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
