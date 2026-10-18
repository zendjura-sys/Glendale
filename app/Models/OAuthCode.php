<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $oauth_client_id
 * @property int $user_id
 * @property string $code_hash
 * @property string $redirect_uri
 * @property list<string> $scopes
 * @property string|null $code_challenge
 * @property Carbon $expires_at
 * @property Carbon|null $used_at
 */
#[Fillable(['oauth_client_id', 'user_id', 'code_hash', 'redirect_uri', 'scopes', 'code_challenge', 'expires_at', 'used_at'])]
class OAuthCode extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'oauth_codes';

    protected function casts(): array
    {
        return ['scopes' => 'array', 'expires_at' => 'datetime', 'used_at' => 'datetime'];
    }
}
