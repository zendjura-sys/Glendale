<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Відгук адміністраторам: ідея, помилка чи просто думка.
 *
 * @property int $id
 * @property int $user_id
 * @property string $kind
 * @property string $body
 * @property string|null $url
 * @property string $status
 * @property Carbon $created_at
 * @property-read User|null $user
 */
#[Fillable(['user_id', 'kind', 'body', 'url', 'status'])]
class Feedback extends Model
{
    protected $table = 'feedback';

    public const KINDS = [
        'idea' => 'Ідея',
        'bug' => 'Помилка',
        'other' => 'Інше',
    ];

    public const NEW = 'new';

    public const READ = 'read';

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
