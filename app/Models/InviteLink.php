<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Посилання, за яким людина вступає в клан, сім’ю або спільноту, приєднується до паті
 * чи одразу заходить у голосову кімнату.
 *
 * @property int $id
 * @property string $token
 * @property string $kind
 * @property int $subject_id
 * @property int $user_id
 * @property Carbon $expires_at
 */
#[Fillable(['token', 'kind', 'subject_id', 'user_id', 'expires_at'])]
class InviteLink extends Model
{
    public const CLAN = 'clan';

    public const FAMILY = 'family';

    public const COMMUNITY = 'community';

    public const PARTY = 'party';

    public const VOICE = 'voice';

    public const KINDS = [self::CLAN, self::FAMILY, self::COMMUNITY, self::PARTY, self::VOICE];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function freshEnough(): bool
    {
        return $this->expires_at->isFuture();
    }
}
