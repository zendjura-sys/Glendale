<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * Клан або гільдія мультиплеєрної гри. Тип додає префікс до назви, розділи вмикає засновник.
 *
 * @property int $id
 * @property string $slug
 * @property string $type
 * @property string $name
 * @property string $tag
 * @property int $game_id
 * @property int $owner_id
 * @property string|null $description
 * @property string|null $rules
 * @property string|null $logo_path
 * @property list<string> $features
 * @property array<int|string, string>|null $rank_titles
 * @property array<string, list<int>>|null $permissions
 * @property string $join_mode
 * @property bool $is_recruiting
 * @property string $currency
 * @property int $treasury
 * @property int $members_count
 * @property int|null $conversation_id
 * @property-read string|null $logo_url
 * @property-read string $display_name
 */
#[Fillable(['slug', 'type', 'name', 'tag', 'game_id', 'owner_id', 'description', 'rules', 'logo_path', 'features', 'rank_titles', 'permissions', 'join_mode', 'is_recruiting', 'currency'])]
class Clan extends Model
{
    public const TYPES = ['clan' => 'Клан', 'guild' => 'Гільдія'];

    /** Розділи, які засновник обирає при створенні (і змінює в налаштуваннях). */
    public const FEATURES = [
        'news' => ['label' => 'Стрічка новин', 'text' => 'Оголошення й новини для учасників'],
        'events' => ['label' => 'Заходи', 'text' => 'Рейди, турніри, збори — з відмітками «Іду»'],
        'treasury' => ['label' => 'Внески', 'text' => 'Скарбниця клану: внески учасників і витрати'],
        'voice' => ['label' => 'Голосові кімнати', 'text' => 'Канали для розмов, як у Discord'],
        'chat' => ['label' => 'Чат', 'text' => 'Спільна бесіда учасників у месенджері'],
        'rating' => ['label' => 'Рейтинг', 'text' => 'Таблиця учасників за внесками й участю в заходах'],
        'rules' => ['label' => 'Статут', 'text' => 'Правила клану на окремій вкладці'],
    ];

    public const DEFAULT_FEATURES = ['news', 'events', 'voice', 'chat'];

    public const JOIN_OPEN = 'open';

    public const JOIN_REQUEST = 'request';

    public const JOIN_CLOSED = 'closed';

    public const JOIN_MODES = [self::JOIN_OPEN => 'Вільний вступ', self::JOIN_REQUEST => 'За заявкою', self::JOIN_CLOSED => 'Набір закрито'];

    public const LEADER_RANK = 5;

    public const RANKS = [
        'clan' => [1 => 'Новачок', 2 => 'Боєць', 3 => 'Ветеран', 4 => 'Офіцер', 5 => 'Лідер'],
        'guild' => [1 => 'Рекрут', 2 => 'Член гільдії', 3 => 'Ветеран', 4 => 'Офіцер', 5 => 'Глава'],
    ];

    /** Права за рангами (1–4); ранг 5 і засновник можуть усе. */
    public const PERMISSIONS = [
        'members.manage' => 'Приймати заявки, змінювати ранги, виключати',
        'news.post' => 'Публікувати новини',
        'events.manage' => 'Створювати заходи',
        'treasury.manage' => 'Підтверджувати внески й записувати витрати',
        'voice.manage' => 'Голосові кімнати: створювати, вимикати мікрофон, виключати',
        'settings.manage' => 'Змінювати опис, статут, розділи, ранги й права',
    ];

    public const DEFAULT_PERMISSIONS = [
        'members.manage' => [4],
        'news.post' => [4],
        'events.manage' => [3, 4],
        'treasury.manage' => [4],
        'voice.manage' => [4],
        'settings.manage' => [],
    ];

    protected function casts(): array
    {
        return [
            'features' => 'array',
            'rank_titles' => 'array',
            'permissions' => 'array',
            'is_recruiting' => 'boolean',
            'treasury' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @return BelongsTo<Game, $this>
     */
    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return HasMany<ClanMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(ClanMember::class);
    }

    /**
     * @return HasMany<ClanMember, $this>
     */
    public function activeMembers(): HasMany
    {
        return $this->members()->where('status', ClanMember::STATUS_ACTIVE);
    }

    public function hasFeature(string $feature): bool
    {
        return in_array($feature, $this->features, true);
    }

    public function rankTitle(int $rank): string
    {
        return (string) ($this->rank_titles[$rank] ?? $this->rank_titles[(string) $rank] ?? self::RANKS[$this->type][$rank] ?? "Ранг {$rank}");
    }

    /**
     * @return array<int, string>
     */
    public function rankTitles(): array
    {
        $titles = [];
        foreach (range(1, self::LEADER_RANK) as $rank) {
            $titles[$rank] = $this->rankTitle($rank);
        }

        return $titles;
    }

    /**
     * @return array<string, list<int>>
     */
    public function permissionMatrix(): array
    {
        $matrix = [];
        foreach (self::DEFAULT_PERMISSIONS as $key => $ranks) {
            $matrix[$key] = array_map('intval', (array) ($this->permissions[$key] ?? $ranks));
        }

        return $matrix;
    }

    public function rankAllows(int $rank, string $permission): bool
    {
        return $rank >= self::LEADER_RANK || in_array($rank, $this->permissionMatrix()[$permission] ?? [], true);
    }

    /**
     * @return Attribute<non-falsy-string, never>
     */
    protected function displayName(): Attribute
    {
        return Attribute::get(fn () => '['.(self::TYPES[$this->type] ?? 'Клан').'] '.$this->name);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function logoUrl(): Attribute
    {
        return Attribute::get(fn () => $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null);
    }

    /**
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'type' => $this->type,
            'type_label' => self::TYPES[$this->type] ?? $this->type,
            'name' => $this->name,
            'display_name' => $this->display_name,
            'tag' => $this->tag,
            'logo_url' => $this->logo_url,
            'members_count' => $this->members_count,
            'is_recruiting' => $this->is_recruiting && $this->join_mode !== self::JOIN_CLOSED,
            'join_mode' => $this->join_mode,
            'game' => $this->relationLoaded('game') ? $this->game?->toCard() : null,
        ];
    }
}
