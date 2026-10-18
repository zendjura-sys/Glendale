<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Підписка браузера на Web Push (сповіщення сайту, коли вкладка закрита).
 *
 * @property int $id
 * @property int $user_id
 * @property string $endpoint
 * @property string $endpoint_hash
 * @property string $p256dh
 * @property string $auth
 * @property string|null $user_agent
 * @property Carbon|null $last_used_at
 */
#[Fillable(['user_id', 'endpoint', 'endpoint_hash', 'p256dh', 'auth', 'user_agent', 'last_used_at'])]
class WebPushSubscription extends Model
{
    protected function casts(): array
    {
        return ['last_used_at' => 'datetime'];
    }
}
