<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Заявка на верифікацію (2.0): вид позначки, посилання-докази, необовʼязковий документ.
 *
 * @property int $id
 * @property int $user_id
 * @property string $kind
 * @property string $status
 * @property list<string>|null $links
 * @property string|null $note
 * @property string|null $document_path Приватний диск; видаляється одразу після рішення
 * @property int|null $reviewer_id
 * @property string|null $reason
 * @property Carbon|null $decided_at
 * @property Carbon $created_at
 */
#[Fillable(['user_id', 'kind', 'status', 'links', 'note', 'document_path', 'reviewer_id', 'reason', 'decided_at'])]
class VerificationRequest extends Model
{
    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const NEEDS_INFO = 'needs_info';

    protected function casts(): array
    {
        return ['links' => 'array', 'decided_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
