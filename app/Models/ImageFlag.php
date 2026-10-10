<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $kind photo | post_image
 * @property int $subject_id
 * @property int|null $user_id
 * @property string $path
 * @property float $score
 * @property string $status pending | kept | removed
 * @property Carbon $created_at
 * @property-read User|null $user
 */
#[Fillable(['kind', 'subject_id', 'user_id', 'path', 'score', 'status'])]
class ImageFlag extends Model
{
    public const PENDING = 'pending';

    public const KEPT = 'kept';

    public const REMOVED = 'removed';

    protected function casts(): array
    {
        return ['score' => 'float'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
