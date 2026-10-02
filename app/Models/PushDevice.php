<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * FCM-токен пристрою, на який надсилаються push-сповіщення застосунку.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $api_token_id
 * @property string $token
 * @property string $platform
 * @property bool $local_render
 * @property Carbon|null $last_used_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 */
class PushDevice extends Model
{
    public const PLATFORMS = ['android', 'ios'];

    protected $fillable = ['user_id', 'api_token_id', 'token', 'platform', 'local_render', 'last_used_at'];

    protected function casts(): array
    {
        return [
            'local_render' => 'boolean',
            'last_used_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
