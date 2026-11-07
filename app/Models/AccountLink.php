<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Людина в складі агенції, команди чи студії (owner — спеціальний акаунт).
 *
 * @property int $id
 * @property int $owner_id
 * @property int $member_id
 * @property string|null $role
 * @property string $status pending | active
 */
#[Fillable(['owner_id', 'member_id', 'role', 'status'])]
class AccountLink extends Model
{
    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return BelongsTo<User, $this> */
    public function member(): BelongsTo
    {
        return $this->belongsTo(User::class, 'member_id');
    }
}
