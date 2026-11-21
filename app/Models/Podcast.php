<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Подкаст автора.
 *
 * @property int $id
 * @property int $user_id
 * @property string $title
 * @property string|null $description
 * @property string|null $cover_path
 * @property string $category
 * @property int $subscribers_count
 * @property Carbon $created_at
 * @property-read string|null $cover_url
 */
#[Fillable(['user_id', 'title', 'description', 'cover_path', 'category', 'subscribers_count'])]
class Podcast extends Model
{
    public const CATEGORIES = ['games' => 'Ігри', 'esports' => 'Кіберспорт', 'tech' => 'Технології', 'culture' => 'Кіно й культура', 'talk' => 'Розмови', 'other' => 'Інше'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<PodcastEpisode, $this> */
    public function episodes(): HasMany
    {
        return $this->hasMany(PodcastEpisode::class);
    }

    /** @return Attribute<string|null, never> */
    protected function coverUrl(): Attribute
    {
        return Attribute::get(fn () => $this->cover_path ? Storage::disk('public')->url($this->cover_path) : null);
    }
}
