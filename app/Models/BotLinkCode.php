<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code_hash
 * @property string $platform
 * @property string $purpose group | account
 * @property string|null $owner_type
 * @property int|null $owner_id
 * @property int $user_id
 * @property Carbon $expires_at
 * @property Carbon|null $used_at
 */
#[Fillable(['code_hash', 'platform', 'purpose', 'owner_type', 'owner_id', 'user_id', 'expires_at', 'used_at'])]
class BotLinkCode extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }
}
