<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Мультиплеєрна гра з каталогу: платформи, жанри й прямі посилання на магазини.
 *
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string $letter
 * @property string $category
 * @property list<string>|null $platforms
 * @property list<string>|null $genres
 * @property list<array{store: string, url: string}>|null $links
 * @property string|null $cover
 * @property Carbon|null $released
 * @property float|null $rating
 * @property int $popularity
 * @property int|null $rawg_id
 * @property Carbon|null $links_checked_at
 * @property bool $is_published
 */
#[Fillable(['slug', 'name', 'letter', 'category', 'platforms', 'genres', 'links', 'cover', 'released', 'rating', 'popularity', 'rawg_id', 'links_checked_at', 'is_published'])]
class Game extends Model
{
    /** Розділи каталогу — від ПК до мобільних. */
    public const CATEGORIES = [
        'pc' => 'ПК',
        'mobile' => 'Мобільні',
        'console' => 'Консолі',
    ];

    public const PLATFORMS = [
        'pc' => 'ПК',
        'mac' => 'macOS',
        'linux' => 'Linux',
        'android' => 'Android',
        'ios' => 'iOS',
        'playstation' => 'PlayStation',
        'xbox' => 'Xbox',
        'switch' => 'Nintendo Switch',
    ];

    public const STORES = [
        'steam' => 'Steam',
        'epic' => 'Epic Games',
        'gplay' => 'Google Play',
        'appstore' => 'App Store',
        'playstation' => 'PlayStation Store',
        'xbox' => 'Microsoft Store',
        'nintendo' => 'Nintendo eShop',
        'gog' => 'GOG',
        'itch' => 'itch.io',
        'website' => 'Офіційний сайт',
    ];

    protected function casts(): array
    {
        return [
            'platforms' => 'array',
            'genres' => 'array',
            'links' => 'array',
            'released' => 'date',
            'rating' => 'float',
            'links_checked_at' => 'datetime',
            'is_published' => 'boolean',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @param  Builder<Game>  $query
     */
    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true);
    }

    /** Літера для покажчика A–Z: латинська велика або «#» для цифр та інших символів. */
    public static function letterOf(string $name): string
    {
        $first = strtoupper(mb_substr(ltrim($name), 0, 1));

        return preg_match('/^[A-Z]$/', $first) === 1 ? $first : '#';
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
            'category' => $this->category,
            'category_label' => self::CATEGORIES[$this->category] ?? $this->category,
            'platforms' => array_map(fn (string $p) => ['key' => $p, 'label' => self::PLATFORMS[$p] ?? $p], $this->platforms ?? []),
            'genres' => array_slice($this->genres ?? [], 0, 3),
            'cover' => $this->cover,
            'year' => $this->released?->year,
        ];
    }

    /**
     * @return list<array{store: string, label: string, url: string}>
     */
    public function storeLinks(): array
    {
        return array_map(fn (array $l) => [
            'store' => $l['store'],
            'label' => self::STORES[$l['store']] ?? $l['store'],
            'url' => $l['url'],
        ], $this->links ?? []);
    }
}
