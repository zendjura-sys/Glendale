<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Результат у челенджі: число (очки, час у секундах…) і скриншот; зараховується після перевірки організатором.
 *
 * @property int $id
 * @property int $tournament_id
 * @property int $tournament_entry_id
 * @property string $value
 * @property string|null $proof_path
 * @property string|null $note
 * @property string $status
 * @property int|null $reviewed_by
 * @property Carbon $created_at
 * @property-read TournamentEntry $entry
 */
#[Fillable(['tournament_id', 'tournament_entry_id', 'value', 'proof_path', 'note', 'status', 'reviewed_by'])]
class TournamentSubmission extends Model
{
    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    protected $attributes = ['status' => self::PENDING];

    /**
     * @return BelongsTo<TournamentEntry, $this>
     */
    public function entry(): BelongsTo
    {
        return $this->belongsTo(TournamentEntry::class, 'tournament_entry_id');
    }
}
