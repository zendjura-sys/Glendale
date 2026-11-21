<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Канал спільноти: текстовий, «Оголошення» (пишуть лише адміністратори) або голосовий.
 *
 * @property int $id
 * @property int $community_id
 * @property int|null $category_id
 * @property string $name
 * @property string $type
 * @property string|null $topic
 * @property bool $is_private
 * @property int $position
 * @property int|null $conversation_id
 * @property int|null $voice_room_id
 * @property Carbon $created_at
 * @property-read Community $community
 * @property-read Conversation|null $conversation
 * @property-read VoiceRoom|null $voiceRoom
 */
#[Fillable(['community_id', 'category_id', 'name', 'type', 'topic', 'is_private', 'position', 'conversation_id', 'voice_room_id'])]
class CommunityChannel extends Model
{
    public const TEXT = 'text';

    public const ANNOUNCEMENT = 'announcement';

    public const VOICE = 'voice';

    public const TYPES = [self::TEXT, self::ANNOUNCEMENT, self::VOICE];

    protected function casts(): array
    {
        return ['is_private' => 'boolean', 'position' => 'integer'];
    }

    public function isVoice(): bool
    {
        return $this->type === self::VOICE;
    }

    /**
     * @return BelongsTo<Community, $this>
     */
    public function community(): BelongsTo
    {
        return $this->belongsTo(Community::class);
    }

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return BelongsTo<VoiceRoom, $this>
     */
    public function voiceRoom(): BelongsTo
    {
        return $this->belongsTo(VoiceRoom::class);
    }

    /**
     * Хто бачить приватний канал (крім адміністраторів спільноти).
     *
     * @return BelongsToMany<User, $this>
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'community_channel_members');
    }
}
