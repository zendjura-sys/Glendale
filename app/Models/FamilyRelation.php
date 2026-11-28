<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Стосунки двох сімей одного сервера: союз (потребує згоди другої сторони) або війна (оголошується одразу).
 *
 * @property int $id
 * @property int $family_id
 * @property int $other_family_id
 * @property string $type
 * @property string $status
 * @property string|null $note
 * @property int|null $initiated_by
 * @property Carbon|null $started_at
 * @property Carbon|null $ended_at
 * @property Carbon|null $created_at
 */
#[Fillable(['family_id', 'other_family_id', 'type', 'status', 'note', 'initiated_by', 'started_at', 'ended_at'])]
class FamilyRelation extends Model
{
    public const ALLIANCE = 'alliance';

    public const WAR = 'war';

    public const TYPES = [self::ALLIANCE => 'Союз', self::WAR => 'Війна'];

    public const PENDING = 'pending';

    public const ACTIVE = 'active';

    public const ENDED = 'ended';

    public const DECLINED = 'declined';

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'ended_at' => 'datetime'];
    }

    /** @return BelongsTo<Family, $this> */
    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    /** @return BelongsTo<Family, $this> */
    public function other(): BelongsTo
    {
        return $this->belongsTo(Family::class, 'other_family_id');
    }

    /** Друга сторона відносно сім’ї $family. */
    public function counterpart(Family $family): ?Family
    {
        return $this->family_id === $family->id ? $this->other : $this->family;
    }
}
