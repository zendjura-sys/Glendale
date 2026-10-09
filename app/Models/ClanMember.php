<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Учасник клану: заявка, активний, вийшов або виключений.
 *
 * @property int $id
 * @property int $clan_id
 * @property int $user_id
 * @property int $rank
 * @property string $status
 * @property string|null $nickname
 * @property string|null $note
 * @property list<string>|null $answers
 * @property int $contributed
 * @property Carbon|null $joined_at
 * @property Carbon $created_at
 */
#[Fillable(['clan_id', 'user_id', 'rank', 'status', 'nickname', 'note', 'joined_at', 'answers'])]
class ClanMember extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_LEFT = 'left';

    public const STATUS_KICKED = 'kicked';

    protected function casts(): array
    {
        return ['joined_at' => 'datetime', 'contributed' => 'integer', 'answers' => 'array'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Clan, $this>
     */
    public function clan(): BelongsTo
    {
        return $this->belongsTo(Clan::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(Clan $clan): array
    {
        return [
            'id' => $this->id,
            'user' => $this->user?->toCard(),
            'nickname' => $this->nickname,
            'rank' => $this->rank,
            'rank_title' => $clan->rankTitle($this->rank),
            'is_owner' => $this->user_id === $clan->owner_id,
            'contributed' => $this->contributed,
            'note' => $this->note,
            'answers' => array_values(array_filter((array) $this->answers, 'is_string')),
            'joined_at' => $this->joined_at?->toIso8601String(),
            'applied_at' => $this->created_at->toIso8601String(),
        ];
    }
}
