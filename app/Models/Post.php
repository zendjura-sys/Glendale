<?php

namespace App\Models;

use Database\Factories\PostFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $author_id
 * @property string $wall_type
 * @property int $wall_id
 * @property bool $as_community
 * @property string|null $body
 * @property array<string, mixed>|null $music
 * @property int|null $movie_id
 * @property array{url: string, title: string, thumbnail: string|null, author: string|null, site?: string}|null $link
 * @property array{kind: string, id: int, title: string, hint: string, href: string, image: string|null}|null $card
 * @property string $visibility
 * @property bool $is_pinned
 * @property bool $is_draft
 * @property bool $spoiler
 * @property Carbon|null $edited_at
 * @property Carbon|null $publish_at
 * @property bool $is_pending
 * @property string|null $tag
 * @property string|null $lang Мова тексту (вгадана за текстом)
 * @property int|null $shared_post_id
 * @property int|null $quoted_post_id
 * @property string|null $sticker
 * @property bool $comments_enabled
 * @property int $likes_count
 * @property int $comments_count
 * @property int $views_count
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable(['author_id', 'wall_type', 'wall_id', 'as_community', 'body', 'music', 'movie_id', 'link', 'card', 'visibility', 'is_pinned', 'is_draft', 'comments_enabled', 'spoiler', 'edited_at', 'publish_at', 'shared_post_id', 'quoted_post_id', 'sticker', 'is_pending', 'tag', 'lang'])]
class Post extends Model
{
    /** @use HasFactory<PostFactory> */
    use HasFactory, SoftDeletes;

    public const VISIBILITY_PUBLIC = 'public';

    public const VISIBILITY_FRIENDS = 'friends';

    public const VISIBILITY_PRIVATE = 'private';

    public const VISIBILITIES = [self::VISIBILITY_PUBLIC, self::VISIBILITY_FRIENDS, self::VISIBILITY_PRIVATE];

    /** Скільки хвилин після публікації автор ще може змінити текст. */
    public const EDIT_MINUTES = 15;

    protected function casts(): array
    {
        return [
            'is_pinned' => 'boolean',
            'is_draft' => 'boolean',
            'is_pending' => 'boolean',
            'comments_enabled' => 'boolean',
            'spoiler' => 'boolean',
            'as_community' => 'boolean',
            'music' => 'array',
            'link' => 'array',
            'card' => 'array',
            'edited_at' => 'datetime',
            'publish_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * Оригінал, якщо цей запис — поширення чужого поста.
     *
     * @return BelongsTo<Post, $this>
     */
    public function sharedPost(): BelongsTo
    {
        return $this->belongsTo(self::class, 'shared_post_id');
    }

    /**
     * Запис, який процитовано в цьому пості.
     *
     * @return BelongsTo<Post, $this>
     */
    public function quotedPost(): BelongsTo
    {
        return $this->belongsTo(self::class, 'quoted_post_id');
    }

    /**
     * @return BelongsTo<Movie, $this>
     */
    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }

    /**
     * @return HasOne<Poll, $this>
     */
    public function poll(): HasOne
    {
        return $this->hasOne(Poll::class);
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function wall(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return HasMany<PostAttachment, $this>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(PostAttachment::class)->orderBy('position');
    }

    /**
     * @return HasMany<Comment, $this>
     */
    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    /**
     * @return MorphMany<Like, $this>
     */
    public function likes(): MorphMany
    {
        return $this->morphMany(Like::class, 'likeable');
    }

    /**
     * Записи, які може бачити користувач (null — гість).
     *
     * @param  Builder<Post>  $query
     * @param  list<int>  $friendIds
     */
    public function scopeVisibleTo(Builder $query, ?User $viewer, array $friendIds = []): void
    {
        $query->where('is_draft', false)->where('is_pending', false);
        $query->where(fn (Builder $query) => $query->whereNull('publish_at')->orWhere('publish_at', '<=', now()));
        if ($viewer && ! $viewer->isStaff()) {
            $query->whereNotIn('author_id', UserBlock::query()->where('blocked_id', $viewer->id)->select('user_id'));
        }

        $query->where(function (Builder $query) use ($viewer, $friendIds) {
            $query->where('visibility', self::VISIBILITY_PUBLIC);

            if ($viewer) {
                $query->orWhere('author_id', $viewer->id)
                    ->orWhere(fn (Builder $query) => $query
                        ->where('wall_type', $viewer->getMorphClass())
                        ->where('wall_id', $viewer->id))
                    ->orWhere(fn (Builder $query) => $query
                        ->where('visibility', self::VISIBILITY_FRIENDS)
                        ->whereIn('author_id', $friendIds));
            }
        });

        // Записи закритих спільнот бачать лише учасники.
        $query->where(function (Builder $query) use ($viewer) {
            $query->where('wall_type', '!=', 'community')
                ->orWhereIn('wall_id', fn ($q) => $q->select('id')->from('communities')->where('privacy', Community::PRIVACY_OPEN));

            if ($viewer) {
                $query->orWhereIn('wall_id', fn ($q) => $q->select('community_id')->from('community_members')
                    ->where('user_id', $viewer->id)
                    ->where('status', CommunityMember::STATUS_ACTIVE));
            }
        });
    }
}
