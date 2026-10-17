<?php

namespace App\Models;

use App\Services\Design\SiteThemes;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Стиль сайту, завантажений в Адмінка → Дизайн.
 *
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string|null $description
 * @property string|null $author
 * @property string $path
 * @property string $hash
 * @property int $size
 * @property int $version
 * @property bool $is_active
 * @property int|null $uploaded_by
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable(['slug', 'name', 'description', 'author', 'path', 'hash', 'size', 'version', 'is_active', 'uploaded_by'])]
class SiteTheme extends Model
{
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'size' => 'integer',
            'version' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(SiteThemes::CACHE_KEY));
        static::deleted(fn () => Cache::forget(SiteThemes::CACHE_KEY));
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function url(): string
    {
        return Storage::disk('public')->url($this->path);
    }
}
