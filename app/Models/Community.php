<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string $type
 * @property string $privacy
 * @property string $wall
 * @property string|null $category
 * @property string|null $status
 * @property string|null $description
 * @property string|null $website
 * @property string|null $city
 * @property string|null $avatar_path
 * @property string|null $cover_path
 * @property int|null $owner_id
 * @property int $members_count
 * @property bool $is_verified
 * @property string|null $rules
 * @property string|null $handbook
 * @property string|null $welcome
 * @property list<string>|null $banned_words
 * @property list<string>|null $post_tags
 * @property int $slow_mode
 * @property bool $weekly_digest
 * @property bool $premoderation
 * @property Carbon $created_at
 * @property-read string|null $avatar_url
 * @property-read string|null $cover_url
 * @property string|null $donation_jar Банка Monobank (https://send.monobank.ua/jar/…)
 * @property string|null $donation_note
 */
// Банка — лише для сторінок сайту (картка «Підтримати»); у застосунок і API не віддається.
#[Hidden(['donation_jar', 'donation_note'])]
#[Fillable(['slug', 'name', 'type', 'privacy', 'wall', 'category', 'status', 'description', 'website', 'city', 'avatar_path', 'cover_path', 'owner_id', 'is_verified', 'rules', 'handbook', 'welcome', 'banned_words', 'post_tags', 'slow_mode', 'premoderation', 'weekly_digest'])]
class Community extends Model
{
    use SoftDeletes;

    public const TYPE_GROUP = 'group';

    public const TYPE_PUBLIC = 'public';

    public const TYPES = [self::TYPE_GROUP, self::TYPE_PUBLIC];

    public const PRIVACY_OPEN = 'open';

    public const PRIVACY_CLOSED = 'closed';

    public const PRIVACIES = [self::PRIVACY_OPEN, self::PRIVACY_CLOSED];

    /** Учасники можуть публікувати на стіні. */
    public const WALL_OPEN = 'open';

    /** Публікують лише керівники. */
    public const WALL_CLOSED = 'closed';

    public const WALLS = [self::WALL_OPEN, self::WALL_CLOSED];

    public const CATEGORIES = [
        'games' => 'Ігри',
        'esports' => 'Кіберспорт',
        'cinema' => 'Кіно та серіали',
        'anime' => 'Аніме',
        'music' => 'Музика',
        'tech' => 'Технології',
        'it' => 'IT та розробка',
        'art' => 'Мистецтво',
        'humor' => 'Гумор',
        'sport' => 'Спорт',
        'education' => 'Освіта',
        'business' => 'Бізнес',
        'travel' => 'Подорожі',
        'other' => 'Інше',
    ];

    protected function casts(): array
    {
        return [
            'is_verified' => 'boolean',
            'banned_words' => 'array',
            'post_tags' => 'array',
            'slow_mode' => 'integer',
            'weekly_digest' => 'boolean',
            'premoderation' => 'boolean',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return HasMany<CommunityMember, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(CommunityMember::class);
    }

    /**
     * @return HasMany<CommunityMember, $this>
     */
    public function activeMembers(): HasMany
    {
        return $this->memberships()->where('status', CommunityMember::STATUS_ACTIVE);
    }

    /**
     * @return MorphMany<Post, $this>
     */
    public function posts(): MorphMany
    {
        return $this->morphMany(Post::class, 'wall');
    }

    public function isPublic(): bool
    {
        return $this->type === self::TYPE_PUBLIC;
    }

    public function isClosed(): bool
    {
        return $this->privacy === self::PRIVACY_CLOSED;
    }

    public function membershipFor(?User $user): ?CommunityMember
    {
        if (! $user) {
            return null;
        }

        return $this->memberships()->where('user_id', $user->id)->first();
    }

    /**
     * @param  Builder<Community>  $query
     */
    public function scopeSearch(Builder $query, string $term): void
    {
        $query->where(fn (Builder $q) => $q
            ->where('name', 'like', "%{$term}%")
            ->orWhere('slug', 'like', "%{$term}%")
            ->orWhere('status', 'like', "%{$term}%"));
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function avatarUrl(): Attribute
    {
        return Attribute::get(fn () => $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function coverUrl(): Attribute
    {
        return Attribute::get(fn () => $this->cover_path ? Storage::disk('public')->url($this->cover_path) : null);
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'type' => $this->type,
            'privacy' => $this->privacy,
            'category' => $this->category,
            'category_label' => self::CATEGORIES[$this->category] ?? null,
            'status' => $this->status,
            'avatar_url' => $this->avatar_url,
            'cover_url' => $this->cover_url,
            'members_count' => $this->members_count,
            'is_verified' => $this->is_verified,
        ];
    }
}
