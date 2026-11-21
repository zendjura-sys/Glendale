<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Підключення стрімера до Donatik / Donatello для LiveCast.
 *
 * @property int $id
 * @property int $user_id
 * @property string $provider
 * @property string|null $page_url
 * @property string|null $api_token
 * @property string|null $webhook_key
 * @property string $hook_id
 * @property Carbon|null $last_synced_at
 */
#[Fillable(['user_id', 'provider', 'page_url', 'api_token', 'webhook_key', 'hook_id', 'last_synced_at'])]
class LivecastIntegration extends Model
{
    public const DONATIK = 'donatik';

    public const DONATELLO = 'donatello';

    protected $table = 'livecast_integrations';

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'api_token' => 'encrypted',
            'webhook_key' => 'encrypted',
            'last_synced_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function newHookId(): string
    {
        return Str::lower(Str::random(32));
    }

    /** Публічний URL колбеку для кабінету Donatik/Donatello. */
    public function webhookUrl(): string
    {
        return url('/api/webhooks/livecast/'.$this->provider.'/'.$this->hook_id);
    }
}
