<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
 * @property list<string>|null $modes
 * @property string|null $aliases
 * @property array<string, mixed>|null $details
 * @property list<array{store: string, url: string}>|null $links
 * @property list<string>|null $collections
 * @property string|null $cover
 * @property Carbon|null $released
 * @property float|null $rating
 * @property int $popularity
 * @property int|null $rawg_id
 * @property int|null $igdb_id
 * @property Carbon|null $links_checked_at
 * @property Carbon|null $news_checked_at
 * @property bool $is_published
 */
#[Fillable(['slug', 'name', 'letter', 'category', 'platforms', 'genres', 'modes', 'aliases', 'details', 'links', 'cover', 'released', 'rating', 'popularity', 'rawg_id', 'igdb_id', 'links_checked_at', 'news_checked_at', 'is_published'])]
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

    /** Ігрові режими (IGDB game_modes) — фільтр каталогу. */
    public const MODES = [
        'multiplayer' => 'Мультиплеєр',
        'coop' => 'Кооператив',
        'mmo' => 'MMO',
        'battle_royale' => 'Королівська битва',
        'split_screen' => 'Розділений екран',
        'single' => 'Одиночна гра',
    ];

    /**
     * Можливості каталогу й картки гри, які адмін вмикає чи вимикає (Адмінка → Ігри).
     * Вимкнене відрізається на сервері — однаково для сайту й застосунку.
     */
    public const FEATURES = [
        'summary' => ['label' => 'Опис і сюжет', 'text' => 'Короткий опис гри та розгорнутий сюжет.'],
        'media' => ['label' => 'Трейлери й скриншоти', 'text' => 'Відео з YouTube, скриншоти й арти.'],
        'multiplayer' => ['label' => 'Мультиплеєр', 'text' => 'Скільки гравців онлайн і локально, кооператив, LAN, розділений екран.'],
        'ratings' => ['label' => 'Рейтинги', 'text' => 'Оцінки критиків, гравців і загальна.'],
        'about' => ['label' => 'Про гру', 'text' => 'Розробник, видавець, рушій, серія, камера, теми, скільки гравців чекають.'],
        'age_ratings' => ['label' => 'Вікові рейтинги', 'text' => 'PEGI та ESRB.'],
        'release_dates' => ['label' => 'Дати виходу', 'text' => 'Окремо для кожної платформи.'],
        'languages' => ['label' => 'Мови', 'text' => 'Інтерфейс, субтитри й озвучення; наявність української — окремо.'],
        'time_to_beat' => ['label' => 'Час проходження', 'text' => 'Швидко, зазвичай і на 100% — за даними гравців.'],
        'websites' => ['label' => 'Спільнота й посилання', 'text' => 'Офіційний сайт, Discord, Twitch, YouTube, Reddit, вікі тощо.'],
        'similar' => ['label' => 'Схожі ігри', 'text' => 'Ігри з каталогу, схожі на цю.'],
        'clans' => ['label' => 'Клани на сторінці гри', 'text' => 'Список кланів гри й кнопка «Створити».'],
        'events' => ['label' => 'Події ігор', 'text' => 'Шоукейси й трансляції з IGDB у календарі та на сторінці гри.'],
        'release_events' => ['label' => 'Виходи ігор у календарі', 'text' => 'Дати виходу ігор каталогу на найближчі два місяці (IGDB).'],
        'filter_modes' => ['label' => 'Фільтр за режимом', 'text' => 'MMO, королівська битва, кооператив, розділений екран.'],
        'filter_genres' => ['label' => 'Фільтр за жанром', 'text' => 'Список найпоширеніших жанрів каталогу.'],
        'sorting' => ['label' => 'Сортування', 'text' => 'Популярні, за рейтингом, нові, A–Z.'],
        'alias_search' => ['label' => 'Пошук за іншими назвами', 'text' => 'Знаходить гру за альтернативними й локалізованими назвами.'],
    ];

    /**
     * Стан можливостей: усе, чого немає в збереженому, — увімкнено.
     *
     * @return array<string, bool>
     */
    public static function features(mixed $stored): array
    {
        $stored = is_array($stored) ? $stored : [];
        $out = [];
        foreach (array_keys(self::FEATURES) as $key) {
            $out[$key] = ! array_key_exists($key, $stored) || (bool) $stored[$key];
        }

        return $out;
    }

    /** Сортування каталогу. */
    public const SORTS = [
        'popular' => 'Популярні',
        'rating' => 'За рейтингом',
        'new' => 'Нові',
        'name' => 'A–Z',
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
            'modes' => 'array',
            'details' => 'array',
            'links' => 'array',
            'collections' => 'array',
            'released' => 'date',
            'rating' => 'float',
            'links_checked_at' => 'datetime',
            'news_checked_at' => 'datetime',
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
    /**
     * @return HasMany<GameGuide, $this>
     */
    public function guides(): HasMany
    {
        return $this->hasMany(GameGuide::class);
    }

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
            'rating' => $this->rating,
            'modes' => array_values(array_intersect(array_keys(self::MODES), $this->modes ?? [])),
        ];
    }

    /** Steam appid із посилання каталогу на store.steampowered.com/app/{id}. */
    public function steamAppId(): ?string
    {
        foreach ($this->links ?? [] as $link) {
            if ($link['store'] === 'steam' && preg_match('#/app/(\d+)#', $link['url'], $match) === 1) {
                return $match[1];
            }
        }

        return null;
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
