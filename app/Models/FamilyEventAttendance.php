<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $event_id
 * @property int $member_id
 * @property string $status
 * @property-read FamilyMember $member
 */
#[Fillable(['event_id', 'member_id', 'status'])]
class FamilyEventAttendance extends Model
{
    protected $table = 'family_event_attendance';

    public const STATUS_GOING = 'going';

    public const STATUS_ATTENDED = 'attended';

    public const STATUS_ABSENT = 'absent';

    /** Відповів «не піду» до початку. */
    public const STATUS_DECLINED = 'declined';

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'member_id');
    }
}
