<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

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
 * @property int|null $episodes Скільки серій є в цій озвучці
 * @property Carbon|null $missing_since Відколи провайдер не віддає озвучку
 */
#[Fillable(['provider', 'external_id', 'translation', 'translation_type', 'quality', 'link', 'position', 'is_hidden', 'episodes', 'missing_since'])]
class MovieSource extends Model
{
    /** Скільки днів поспіль провайдер має не віддавати озвучку, щоб її прибрали. */
    public const RETIRE_DAYS = 30;

    public const PROVIDERS = [
        'kodik' => 'Kodik',
        'videoseed' => 'Videoseed',
        'flixcdn' => 'FlixCDN',
        'custom' => 'Власний плеєр',
    ];

    protected function casts(): array
    {
        return ['is_hidden' => 'boolean', 'episodes' => 'integer', 'missing_since' => 'datetime'];
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
            'episodes' => $this->episodes,
        ];
    }
}
