<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int|null $server_id
 * @property int|null $owner_id
 * @property string $slug
 * @property string $name
 * @property string $tag
 * @property string|null $logo_path
 * @property string|null $cover_path
 * @property string|null $description
 * @property string $status
 * @property string|null $status_reason
 * @property Carbon|null $verified_at
 * @property int $treasury
 * @property array<string, mixed>|null $settings
 * @property array<int|string, string>|null $rank_titles
 * @property array<string, list<int>>|null $permissions
 * @property array<string, string|null>|null $webhooks
 * @property int|null $conversation_id
 * @property bool $is_recruiting
 * @property int $members_count
 * @property Carbon $created_at
 * @property-read string|null $logo_url
 * @property-read string|null $cover_url
 */
#[Fillable([
    'server_id', 'owner_id', 'slug', 'name', 'tag', 'description', 'status', 'status_reason', 'verified_at',
    'settings', 'rank_titles', 'permissions', 'webhooks', 'is_recruiting',
])]
class Family extends Model
{
    use SoftDeletes;

    public const STATUS_PENDING = 'pending_verification';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_SUSPENDED = 'suspended';

    public const STATUSES = [
        self::STATUS_PENDING => 'Очікує верифікації',
        self::STATUS_VERIFIED => 'Верифікована',
        self::STATUS_SUSPENDED => 'Призупинена',
    ];

    public const LEADER_RANK = 10;

    public const DEPUTY_RANK = 9;

    public const DEFAULT_RANKS = [
        1 => 'Новачок', 2 => 'Учасник', 3 => 'Боєць', 4 => 'Досвідчений', 5 => 'Ветеран',
        6 => 'Старший', 7 => 'Офіцер', 8 => 'Капітан', 9 => 'Заступник', 10 => 'Лідер',
    ];

    /** Матриця прав: ключ → ранги (1–9), яким дозволено. Ранг 10 і власник можуть усе. */
    public const PERMISSIONS = [
        'members.manage' => 'Приймати заявки, змінювати ранги, виключати',
        'ranks.manage' => 'Назви рангів, обов’язки заступників і права',
        'reports.bizwar' => 'Перевіряти звіти «Бізвар»',
        'reports.contract' => 'Перевіряти звіти «Контракти»',
        'reports.investment' => 'Перевіряти звіти «Інвестиції»',
        'reports.other' => 'Перевіряти звіти «Інше»',
        'treasury.manage' => 'Казна: виплати, ручні операції',
        'warehouse.logs' => 'Бачити журнал складу',
        'warehouse.manage' => 'Керувати складом і квотами',
        'sanctions.issue' => 'Видавати попередження, догани, штрафи',
        'events.manage' => 'Створювати події й відмічати присутніх',
        'audit.view' => 'Переглядати журнал аудиту',
        'settings.manage' => 'Ставки, рейтинг, бот і налаштування',
    ];

    public const DEFAULT_PERMISSIONS = [
        'members.manage' => [8, 9],
        'ranks.manage' => [],
        'reports.bizwar' => [7, 8, 9],
        'reports.contract' => [7, 8, 9],
        'reports.investment' => [9],
        'reports.other' => [8, 9],
        'treasury.manage' => [9],
        'warehouse.logs' => [5, 6, 7, 8, 9],
        'warehouse.manage' => [8, 9],
        'sanctions.issue' => [8, 9],
        'events.manage' => [6, 7, 8, 9],
        'audit.view' => [9],
        'settings.manage' => [9],
    ];

    /** Суми — у гривнях (₴); у базі зберігаються копійки. */
    public const DEFAULT_SETTINGS = [
        'rates' => [
            'bizwar_win' => 500,
            'bizwar_loss' => 150,
            'contract_light' => 200,
            'contract_medium' => 400,
            'contract_heavy' => 700,
            'investment_cashback' => 0,
        ],
        'deposits' => [
            'enabled' => true,
            'daily_rate' => 0.5,
            'weekly_rate' => 4,
            'min_amount' => 1000,
            'max_days' => 30,
            'max_weeks' => 8,
        ],
        'reports' => [
            'deadline_hours' => 48,
            'contract_daily_limit' => 10,
            'require_proof' => true,
            'max_proofs' => 6,
        ],
        'rating' => [
            'bizwar' => true,
            'contracts' => true,
            'investments' => true,
            'events' => true,
            'points_bizwar_win' => 10,
            'points_bizwar_loss' => 3,
            'points_contract_light' => 2,
            'points_contract_medium' => 4,
            'points_contract_heavy' => 7,
            'points_per_1000' => 1,
            'points_event' => 5,
        ],
        'discipline' => [
            'warn_days' => 30,
            'warn_limit' => 3,
            'escalation' => 'demote',
        ],
        'cashout' => [
            'min_amount' => 100,
        ],
        'digest' => [
            'enabled' => true,
            'chat' => true,
        ],
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'rank_titles' => 'array',
            'permissions' => 'array',
            'webhooks' => 'encrypted:array',
            'verified_at' => 'datetime',
            'is_recruiting' => 'boolean',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * @return BelongsTo<GtaServer, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(GtaServer::class, 'server_id')->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return HasMany<FamilyMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(FamilyMember::class);
    }

    /**
     * @return HasMany<FamilyMember, $this>
     */
    public function activeMembers(): HasMany
    {
        return $this->members()->where('status', FamilyMember::STATUS_ACTIVE);
    }

    /**
     * @return HasMany<FamilyReport, $this>
     */
    public function reports(): HasMany
    {
        return $this->hasMany(FamilyReport::class);
    }

    /**
     * @return HasMany<FamilyItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(FamilyItem::class);
    }

    /**
     * @return HasMany<FamilyReportProof, $this>
     */
    public function proofs(): HasMany
    {
        return $this->hasMany(FamilyReportProof::class);
    }

    /**
     * @return HasMany<FamilyCashout, $this>
     */
    public function cashouts(): HasMany
    {
        return $this->hasMany(FamilyCashout::class);
    }

    /**
     * @return HasMany<FamilyDeposit, $this>
     */
    public function deposits(): HasMany
    {
        return $this->hasMany(FamilyDeposit::class);
    }

    /**
     * @return HasMany<FamilyPunishment, $this>
     */
    public function punishments(): HasMany
    {
        return $this->hasMany(FamilyPunishment::class);
    }

    /**
     * @return HasMany<FamilyEvent, $this>
     */
    public function events(): HasMany
    {
        return $this->hasMany(FamilyEvent::class);
    }

    /**
     * @return HasMany<FamilyTransaction, $this>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(FamilyTransaction::class);
    }

    /**
     * @return HasMany<FamilyAuditLog, $this>
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(FamilyAuditLog::class);
    }

    public function isVerified(): bool
    {
        return $this->status === self::STATUS_VERIFIED;
    }

    public function isSuspended(): bool
    {
        return $this->status === self::STATUS_SUSPENDED;
    }

    /**
     * Налаштування з підставленими значеннями за замовчуванням.
     */
    public function setting(string $key, mixed $default = null): mixed
    {
        return Arr::get($this->settings ?? [], $key, Arr::get(self::DEFAULT_SETTINGS, $key, $default));
    }

    /**
     * @return array<string, mixed>
     */
    public function resolvedSettings(): array
    {
        $resolved = [];
        foreach (self::DEFAULT_SETTINGS as $group => $values) {
            $resolved[$group] = array_replace($values, (array) ($this->settings[$group] ?? []));
        }

        return $resolved;
    }

    /**
     * Ставка винагороди в копійках.
     */
    public function rate(string $key): int
    {
        return (int) round((float) $this->setting('rates.'.$key, 0) * 100);
    }

    public function rankTitle(int $rank): string
    {
        return (string) ($this->rank_titles[$rank] ?? $this->rank_titles[(string) $rank] ?? self::DEFAULT_RANKS[$rank] ?? 'Ранг '.$rank);
    }

    /**
     * @return array<int, string>
     */
    public function rankTitles(): array
    {
        $titles = [];
        foreach (range(1, 10) as $rank) {
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

    public function webhook(string $key): ?string
    {
        $value = $this->webhooks[$key] ?? null;

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function logoUrl(): Attribute
    {
        return Attribute::get(fn () => $this->logo_path ? Storage::disk('public')->url($this->logo_path) : null);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function coverUrl(): Attribute
    {
        return Attribute::get(fn () => $this->cover_path ? Storage::disk('public')->url($this->cover_path) : null);
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
            'tag' => $this->tag,
            'logo_url' => $this->logo_url,
            'cover_url' => $this->cover_url,
            'status' => $this->status,
            'status_label' => self::STATUSES[$this->status] ?? $this->status,
            'members_count' => $this->members_count,
            'is_recruiting' => $this->is_recruiting,
            'server' => $this->relationLoaded('server') && $this->server ? [
                'slug' => $this->server->slug,
                'name' => $this->server->name,
                'icon' => $this->server->icon,
                'platform' => $this->server->platform,
            ] : null,
        ];
    }
}
