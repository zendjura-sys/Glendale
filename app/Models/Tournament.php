<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Турнір або челендж сервера GTA.
 *
 * @property int $id
 * @property int $gta_server_id
 * @property int|null $user_id
 * @property string $title
 * @property string|null $description
 * @property string $kind
 * @property string $entry
 * @property int $size
 * @property string|null $metric
 * @property bool $lower_is_better
 * @property string|null $prize
 * @property string $status
 * @property Carbon $starts_at
 * @property Carbon|null $ends_at
 * @property Carbon $created_at
 * @property-read GtaServer $server
 * @property-read User|null $user
 */
#[Fillable(['gta_server_id', 'user_id', 'title', 'description', 'kind', 'entry', 'size', 'metric', 'lower_is_better', 'prize', 'status', 'starts_at', 'ends_at'])]
class Tournament extends Model
{
    public const BRACKET = 'bracket';

    public const CHALLENGE = 'challenge';

    public const OPEN = 'open';

    public const RUNNING = 'running';

    public const FINISHED = 'finished';

    public const CANCELLED = 'cancelled';

    /** Розміри сітки на вибування. */
    public const SIZES = [4, 8, 16, 32, 64];

    protected $attributes = ['entry' => 'solo', 'size' => 16, 'status' => self::OPEN, 'lower_is_better' => false];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'lower_is_better' => 'boolean', 'size' => 'integer'];
    }

    /**
     * @return BelongsTo<GtaServer, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(GtaServer::class, 'gta_server_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<TournamentEntry, $this>
     */
    public function entries(): HasMany
    {
        return $this->hasMany(TournamentEntry::class);
    }

    /**
     * @return HasMany<TournamentMatch, $this>
     */
    public function matches(): HasMany
    {
        return $this->hasMany(TournamentMatch::class);
    }

    /**
     * @return HasMany<TournamentSubmission, $this>
     */
    public function submissions(): HasMany
    {
        return $this->hasMany(TournamentSubmission::class);
    }

    /** Організатор або персонал сайту. */
    public function canManage(User $user): bool
    {
        return $this->user_id === $user->id || $user->isStaff();
    }

    /** Кількість раундів сітки для наявних учасників (2 → 1, 3–4 → 2, 5–8 → 3…). */
    public static function roundsFor(int $entries): int
    {
        return max(1, (int) ceil(log(max(2, $entries), 2)));
    }
}
