<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property string $type
 * @property string|null $title
 * @property string|null $avatar_path
 * @property int|null $owner_id
 * @property string|null $direct_key
 * @property int|null $last_message_id
 * @property Carbon|null $last_message_at
 * @property-read string|null $avatar_url
 */
#[Fillable(['type', 'title', 'avatar_path', 'owner_id', 'direct_key', 'last_message_id', 'last_message_at'])]
class Conversation extends Model
{
    public const TYPE_DIRECT = 'direct';

    public const TYPE_GROUP = 'group';

    public const MAX_MEMBERS = 200;

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    public static function directKey(int $a, int $b): string
    {
        return min($a, $b).':'.max($a, $b);
    }

    public function isGroup(): bool
    {
        return $this->type === self::TYPE_GROUP;
    }

    /**
     * @return HasMany<ConversationParticipant, $this>
     */
    public function participants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    /**
     * @return HasMany<ConversationParticipant, $this>
     */
    public function activeParticipants(): HasMany
    {
        return $this->participants()->whereNull('left_at');
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function lastMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function participantFor(User $user): ?ConversationParticipant
    {
        return $this->participants()->where('user_id', $user->id)->whereNull('left_at')->first();
    }

    /**
     * @param  Builder<Conversation>  $query
     */
    public function scopeForUser(Builder $query, User $user): void
    {
        $query->whereHas('participants', fn (Builder $q) => $q->where('user_id', $user->id)->whereNull('left_at'));
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function avatarUrl(): Attribute
    {
        return Attribute::get(fn () => $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null);
    }
}
