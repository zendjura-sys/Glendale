<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Відповідь на подію сервера: «піду» чи «не піду».
 *
 * @property int $server_event_id
 * @property int $user_id
 * @property string $status
 */
#[Fillable(['server_event_id', 'user_id', 'status'])]
class ServerEventRsvp extends Model
{
    public const GOING = 'going';

    public const DECLINED = 'declined';

    public $timestamps = false;

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
