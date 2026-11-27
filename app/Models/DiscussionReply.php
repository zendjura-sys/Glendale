<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Відповідь у темі обговорення (може відповідати на іншу відповідь — parent_id).
 *
 * @property int $id
 * @property int $discussion_id
 * @property int $user_id
 * @property int|null $parent_id
 * @property string $body
 * @property array<int, mixed>|null $embeds
 * @property bool $spoiler
 * @property int $likes_count
 * @property Carbon $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $user
 * @property-read Discussion|null $discussion
 */
#[Fillable(['discussion_id', 'user_id', 'parent_id', 'body', 'embeds', 'spoiler'])]
class DiscussionReply extends Model
{
    use SoftDeletes;

    protected function casts(): array
    {
        return ['spoiler' => 'boolean', 'embeds' => 'array'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Discussion, $this> */
    public function discussion(): BelongsTo
    {
        return $this->belongsTo(Discussion::class);
    }
}
