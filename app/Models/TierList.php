<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Тір-лист людини.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $game_id
 * @property string $title
 * @property list<array{label: string, color: string, items: list<string>}> $tiers
 * @property bool $is_public
 * @property int $views_count
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable(['user_id', 'game_id', 'title', 'tiers', 'is_public'])]
class TierList extends Model
{
    protected function casts(): array
    {
        return ['tiers' => 'array', 'is_public' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Game, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }
}
