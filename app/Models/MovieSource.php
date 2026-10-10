<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $movie_id
 * @property string $provider
 * @property string $external_id
 * @property string|null $translation
 * @property string|null $translation_type
 * @property string|null $quality
 * @property string $link
 * @property int $position
 * @property bool $is_hidden Схована адміністратором
 */
#[Fillable(['provider', 'external_id', 'translation', 'translation_type', 'quality', 'link', 'position', 'is_hidden'])]
class MovieSource extends Model
{
    public const PROVIDERS = [
        'kodik' => 'Kodik',
        'videoseed' => 'Videoseed',
        'flixcdn' => 'FlixCDN',
        'custom' => 'Власний плеєр',
    ];

    protected function casts(): array
    {
        return ['is_hidden' => 'boolean'];
    }

    /**
     * @return BelongsTo<Movie, $this>
     */
    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function toPlayer(): array
    {
        return [
            'key' => $this->provider.':'.$this->id,
            'id' => $this->id,
            'provider' => $this->provider,
            'provider_label' => self::PROVIDERS[$this->provider] ?? $this->provider,
            'translation' => $this->translation,
            'translation_type' => $this->translation_type,
            'quality' => $this->quality,
            'link' => $this->link,
            'is_hidden' => (bool) $this->is_hidden,
        ];
    }
}
