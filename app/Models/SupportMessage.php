<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $ticket_id
 * @property int|null $user_id
 * @property string $body
 * @property bool $from_staff
 * @property bool $internal
 * @property list<string>|null $attachments
 * @property Carbon $created_at
 * @property-read User|null $user
 */
#[Fillable(['ticket_id', 'user_id', 'body', 'from_staff', 'internal', 'attachments', 'created_at'])]
class SupportMessage extends Model
{
    public const UPDATED_AT = null;

    protected function casts(): array
    {
        return ['from_staff' => 'boolean', 'internal' => 'boolean', 'attachments' => 'array'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
