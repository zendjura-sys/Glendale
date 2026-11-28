<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Сторінка вікі спільноти.
 *
 * @property int $id
 * @property int $community_id
 * @property string $slug
 * @property string $title
 * @property string $body
 * @property int|null $updated_by
 * @property Carbon $updated_at
 */
#[Fillable(['community_id', 'slug', 'title', 'body', 'updated_by'])]
class CommunityWikiPage extends Model
{
    /** @return BelongsTo<User, $this> */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
