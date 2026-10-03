<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $username
 * @property string $first_name
 * @property string $last_name
 * @property string $name
 * @property string $email
 * @property string|null $discord_id
 * @property string|null $discord_username
 * @property string|null $google_id
 * @property string|null $google_email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string $role
 * @property string|null $avatar_path
 * @property string|null $cover_path
 * @property string|null $status
 * @property string|null $about
 * @property string|null $city
 * @property Carbon|null $birthday
 * @property string|null $gender
 * @property string|null $website
 * @property bool $is_verified
 * @property bool $is_private
 * @property string $message_privacy
 * @property Carbon|null $last_seen_at
 * @property Carbon|null $banned_at
 * @property string|null $ban_reason
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property list<string>|null $nav_tabs Розділи нижньої панелі (ключі модулів); null — типові.
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'username', 'first_name', 'last_name', 'email', 'password',
    'status', 'about', 'city', 'birthday', 'gender', 'website', 'is_private', 'message_privacy', 'email_social',
])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token', 'email', 'ban_reason', 'google_email'])]
class User extends Authenticatable implements MustVerifyEmail, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    public const ROLE_USER = 'user';

    public const ROLE_MODERATOR = 'moderator';

    public const ROLE_ADMIN = 'admin';

    public const ROLES = [self::ROLE_USER, self::ROLE_MODERATOR, self::ROLE_ADMIN];

    /** Розділи нижньої панелі на телефоні, якщо користувач нічого не обрав. */
    public const DEFAULT_NAV = ['profile', 'feed', 'messages', 'friends'];

    /** Скільки розділів поміщається в панелі поруч із «Меню». */
    public const MAX_NAV = 4;

    public const MESSAGES_EVERYONE = 'everyone';

    public const MESSAGES_FRIENDS = 'friends';

    public const MESSAGE_PRIVACY = [self::MESSAGES_EVERYONE, self::MESSAGES_FRIENDS];

    protected $appends = ['avatar_url', 'cover_url', 'is_online'];

    protected static function booted(): void
    {
        static::saving(function (User $user) {
            $user->name = trim($user->first_name.' '.$user->last_name);
        });
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'birthday' => 'date',
            'last_seen_at' => 'datetime',
            'banned_at' => 'datetime',
            'is_verified' => 'boolean',
            'is_private' => 'boolean',
            'email_social' => 'boolean',
            'nav_tabs' => 'array',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'username';
    }

    /**
     * @return BelongsToMany<Track, $this>
     */
    public function library(): BelongsToMany
    {
        return $this->belongsToMany(Track::class, 'music_library')->withPivot('created_at');
    }

    /**
     * @return HasMany<Playlist, $this>
     */
    public function playlists(): HasMany
    {
        return $this->hasMany(Playlist::class);
    }

    /**
     * @return BelongsToMany<Movie, $this>
     */
    public function movies(): BelongsToMany
    {
        return $this->belongsToMany(Movie::class)->withPivot(['status', 'rating', 'watched_at'])->withTimestamps();
    }

    /**
     * @return HasOne<SpotifyAccount, $this>
     */
    public function spotifyAccount(): HasOne
    {
        return $this->hasOne(SpotifyAccount::class);
    }

    /**
     * @return HasOne<MusicStatus, $this>
     */
    public function musicStatus(): HasOne
    {
        return $this->hasOne(MusicStatus::class);
    }

    /**
     * @return HasMany<Post, $this>
     */
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class, 'author_id');
    }

    /**
     * @return MorphMany<Post, $this>
     */
    public function wallPosts(): MorphMany
    {
        return $this->morphMany(Post::class, 'wall');
    }

    /**
     * @return HasMany<Friendship, $this>
     */
    public function sentFriendRequests(): HasMany
    {
        return $this->hasMany(Friendship::class, 'requester_id');
    }

    /**
     * @return HasMany<Friendship, $this>
     */
    public function receivedFriendRequests(): HasMany
    {
        return $this->hasMany(Friendship::class, 'addressee_id');
    }

    /**
     * @return HasMany<ConversationParticipant, $this>
     */
    public function conversationParticipants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    /**
     * @return HasMany<FamilyMember, $this>
     */
    public function familyMemberships(): HasMany
    {
        return $this->hasMany(FamilyMember::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isStaff(): bool
    {
        return in_array($this->role, [self::ROLE_ADMIN, self::ROLE_MODERATOR], true);
    }

    public function isBanned(): bool
    {
        return $this->banned_at !== null;
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
     * @return Attribute<bool, never>
     */
    protected function isOnline(): Attribute
    {
        return Attribute::get(fn () => $this->last_seen_at !== null && $this->last_seen_at->gt(now()->subMinutes(5)));
    }

    /**
     * Компактне представлення для карток, коментарів і автора запису.
     *
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'username' => $this->username,
            'name' => $this->name,
            'first_name' => $this->first_name,
            'avatar_url' => $this->avatar_url,
            'is_online' => $this->is_online,
            'is_verified' => $this->is_verified,
            'status' => $this->status,
        ];
    }
}
