<?php

namespace App\Models;

use App\Support\I18n\Locales;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string $platform
 * @property string $multiplayer
 * @property string|null $tagline
 * @property string|null $description
 * @property string|null $website
 * @property string|null $discord_invite
 * @property string|null $telegram
 * @property string|null $connect
 * @property string|null $icon_path
 * @property string|null $icon_url
 * @property string|null $icon_source
 * @property Carbon|null $icon_fetched_at
 * @property int|null $players_online
 * @property int|null $players_max
 * @property int|null $players_peak
 * @property int|null $discord_members
 * @property int|null $discord_online
 * @property Carbon|null $stats_updated_at
 * @property string $status
 * @property string $origin
 * @property string|null $review_note
 * @property int|null $suggested_by
 * @property bool $is_featured
 * @property int $position
 * @property int|null $families_count
 * @property string|null $discord_guild_id
 * @property string $language
 * @property Carbon|null $discord_events_at
 * @property Carbon $created_at
 * @property-read string|null $icon
 */
#[Fillable([
    'slug', 'name', 'platform', 'multiplayer', 'tagline', 'description', 'website', 'discord_invite', 'telegram',
    'connect', 'icon_url', 'status', 'origin', 'review_note', 'suggested_by', 'is_featured', 'position',
    'discord_guild_id', 'discord_events_at', 'language',
])]
class GtaServer extends Model
{
    use SoftDeletes;

    public const PLATFORMS = ['pc' => 'ПК', 'mobile' => 'Мобільний'];

    /**
     * Мови серверів і заголовок каталогу («Німецькі GTA RP сервери») — українською,
     * перекладається разом з інтерфейсом.
     */
    public const LANGUAGES = [
        'uk' => 'Українські',
        'en' => 'Англомовні',
        'de' => 'Німецькі',
        'fr' => 'Франкомовні',
        'es' => 'Іспаномовні',
        'it' => 'Італійські',
        'pl' => 'Польські',
        'pt' => 'Португаломовні',
        'ru' => 'Російськомовні',
        'tr' => 'Турецькі',
        'cs' => 'Чеські',
        'ro' => 'Румунські',
        'nl' => 'Нідерландські',
        'hu' => 'Угорські',
        'sv' => 'Шведські',
        'kk' => 'Казахські',
        'ar' => 'Арабомовні',
        'zh' => 'Китайські',
        'ja' => 'Японські',
        'ko' => 'Корейські',
        'vi' => 'В’єтнамські',
        'th' => 'Тайські',
        'id' => 'Індонезійські',
    ];

    /**
     * Мови для форм: код → назва мовою самою («Deutsch», «日本語»).
     *
     * @return array<string, string>
     */
    public static function languageOptions(): array
    {
        $out = [];
        foreach (array_keys(self::LANGUAGES) as $code) {
            $out[$code] = Locales::nativeName($code);
        }

        return $out;
    }

    public const MULTIPLAYERS = [
        'ragemp' => 'RAGE:MP',
        'altv' => 'alt:V',
        'fivem' => 'FiveM',
        'own' => 'Власний клієнт',
        'samp' => 'SA-MP / CR-MP',
        'launcher' => 'Мобільний лаунчер',
        'other' => 'Інше',
    ];

    public const STATUS_PUBLISHED = 'published';

    public const STATUS_PENDING = 'pending';

    public const STATUS_REJECTED = 'rejected';

    public const STATUSES = [self::STATUS_PUBLISHED, self::STATUS_PENDING, self::STATUS_REJECTED];

    public const ORIGINS = [
        'seed' => 'Базовий список',
        'manual' => 'Додано адміном',
        'discovered' => 'Знайдено автоматично',
        'suggested' => 'Запропоновано гравцем',
    ];

    protected function casts(): array
    {
        return [
            'is_featured' => 'boolean',
            'icon_fetched_at' => 'datetime',
            'stats_updated_at' => 'datetime',
            'discord_events_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @return HasMany<Family, $this>
     */
    public function families(): HasMany
    {
        return $this->hasMany(Family::class, 'server_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function suggester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'suggested_by');
    }

    /**
     * @param  Builder<GtaServer>  $query
     */
    public function scopePublished(Builder $query): void
    {
        $query->where('status', self::STATUS_PUBLISHED);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function icon(): Attribute
    {
        return Attribute::get(fn () => $this->icon_path ? Storage::disk('public')->url($this->icon_path) : $this->icon_url);
    }

    public function discordUrl(): ?string
    {
        return $this->discord_invite ? 'https://discord.gg/'.$this->discord_invite : null;
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
            'platform' => $this->platform,
            'platform_label' => self::PLATFORMS[$this->platform] ?? $this->platform,
            'multiplayer' => $this->multiplayer,
            'multiplayer_label' => self::MULTIPLAYERS[$this->multiplayer] ?? $this->multiplayer,
            'language' => $this->language,
            'tagline' => $this->tagline,
            'icon' => $this->icon,
            'website' => $this->website,
            'discord' => $this->discordUrl(),
            'telegram' => $this->telegram,
            'connect' => $this->connect,
            'players_online' => $this->players_online,
            'players_max' => $this->players_max,
            'players_peak' => $this->players_peak,
            'discord_members' => $this->discord_members,
            'discord_online' => $this->discord_online,
            'stats_updated_at' => $this->stats_updated_at?->toIso8601String(),
            'is_featured' => $this->is_featured,
            'families_count' => (int) ($this->families_count ?? 0),
        ];
    }
}
