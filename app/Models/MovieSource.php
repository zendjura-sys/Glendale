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
 */
#[Fillable(['provider', 'external_id', 'translation', 'translation_type', 'quality', 'link', 'position'])]
class MovieSource extends Model
{
    public const PROVIDERS = [
        'kodik' => 'Kodik',
        'flixcdn' => 'FlixCDN',
        'custom' => 'Власний плеєр',
    ];

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
        ];
    }
}
