<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Інтернет-радіостанція (вкладка «Радіо»): потік https, логотип і жанр. Додає адміністратор.
 *
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property string|null $tagline
 * @property string $stream_url
 * @property string|null $homepage
 * @property string|null $logo_path
 * @property string|null $genre
 * @property string|null $country
 * @property bool $is_active
 * @property int $position
 * @property Carbon $created_at
 * @property-read string|null $logo_url
 */
#[Fillable(['name', 'slug', 'tagline', 'stream_url', 'homepage', 'logo_path', 'genre', 'country', 'is_active', 'position'])]
class RadioStation extends Model
{
    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function logoUrl(): Attribute
    {
        return Attribute::get(fn () => $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null);
    }

    /**
     * Картка для плеєра: такі самі ключі, як у треку, щоб станція грала тим самим плеєром.
     *
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'source' => 'radio',
            'id' => $this->id,
            'key' => 'radio:'.$this->id,
            'title' => $this->name,
            'artist' => $this->tagline ?? '',
            'album' => null,
            'genre' => $this->genre,
            'duration' => 0,
            'url' => $this->stream_url,
            'cover_url' => $this->logo_url,
            'homepage' => $this->homepage,
            'slug' => $this->slug,
            'live' => true,
        ];
    }
}
