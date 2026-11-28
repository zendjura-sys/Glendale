<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Сторінка вікі сім’ї: гайди, правила роботи, корисні посилання — лише для учасників.
 *
 * @property int $id
 * @property int $family_id
 * @property string $slug
 * @property string $title
 * @property string|null $body
 * @property int $position
 * @property int|null $updated_by
 * @property Carbon|null $updated_at
 */
#[Fillable(['family_id', 'slug', 'title', 'body', 'position', 'updated_by'])]
class FamilyWikiPage extends Model
{
    /** @return BelongsTo<User, $this> */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
