<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Скарга на людину (профіль, поведінка), а не на окреме повідомлення.
 *
 * @property int $id
 * @property int $user_id
 * @property int $reporter_id
 * @property string $reason
 * @property string|null $comment
 * @property string $status
 * @property int|null $resolved_by
 * @property string|null $resolution
 * @property Carbon $created_at
 * @property-read User|null $user
 * @property-read User|null $reporter
 */
#[Fillable(['user_id', 'reporter_id', 'reason', 'comment', 'status', 'resolved_by', 'resolution'])]
class UserReport extends Model
{
    public const REASONS = [
        'spam' => 'Спам або реклама',
        'abuse' => 'Образи, цькування',
        'fake' => 'Фейкова сторінка',
        'scam' => 'Шахрайство',
        'cheat' => 'Читерство',
        // Сексуальне насильство над дітьми чи їх експлуатація (CSAE) — першочергово, див. /child-safety.
        'child_safety' => 'Загроза дитині, сексуальна експлуатація',
        'other' => 'Інше',
    ];

    public const PENDING = 'pending';

    public const RESOLVED = 'resolved';

    public const DISMISSED = 'dismissed';

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }
}
