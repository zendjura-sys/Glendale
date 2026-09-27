<?php

namespace Addons\MemberCenter\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Покарання учасника за правилами родини (розділ 8) — історично таблиця
 * member_warnings, тому й назва класу лишилась (на неї посилаються
 * слухачі інших модулів).
 */
class MemberWarning extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'member_warnings';

    protected $fillable = [
        'user_id', 'author_id', 'type', 'rule_code', 'severity', 'reason', 'amount', 'original_amount',
        'status', 'due_at', 'expires_at', 'paid_at', 'paid_via', 'resolved_by', 'resolved_at',
        'resolution_note', 'auto', 'source_id',
    ];

    protected $casts = [
        'due_at' => 'datetime',
        'expires_at' => 'datetime',
        'paid_at' => 'datetime',
        'resolved_at' => 'datetime',
        'auto' => 'boolean',
        'amount' => 'integer',
        'original_amount' => 'integer',
    ];

    public const TYPES = ['remark', 'fine', 'reprimand', 'demotion', 'kick', 'blacklist'];

    public const TYPE_LABELS = [
        'remark' => 'Зауваження',
        'fine' => 'Штраф',
        'reprimand' => 'Догана',
        'demotion' => 'Пониження',
        'kick' => 'Виключення',
        'blacklist' => 'Чорний список',
    ];

    public const TYPE_EMOJI = [
        'remark' => '📝',
        'fine' => '🧾',
        'reprimand' => '⚠️',
        'demotion' => '⬇️',
        'kick' => '🚪',
        'blacklist' => '⛔',
    ];

    public const STATUS_LABELS = [
        'active' => 'Діє',
        'paid' => 'Сплачено',
        'overdue' => 'Прострочено',
        'expired' => 'Згоріло',
        'converted' => 'Перетворено на догану',
        'revoked' => 'Скасовано',
    ];

    /** Скільки днів діє зауваження / догана без нових порушень (п. 8.3). */
    public const LIFETIME_DAYS = ['remark' => 7, 'reprimand' => 14];

    public const FINE_DUE_HOURS = 48;

    // Легасі-поле: старий UI кадрового обліку показував severity.
    public const SEVERITIES = ['notice', 'warning', 'severe'];

    public const SEVERITY_LABELS = [
        'notice' => 'Зауваження',
        'warning' => 'Попередження',
        'severe' => 'Сувора догана',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function isUnpaidFine(): bool
    {
        return $this->type === 'fine' && in_array($this->status, ['active', 'overdue'], true);
    }

    public function label(): string
    {
        return self::TYPE_LABELS[$this->type] ?? 'Покарання';
    }

    /** Формат для сайту й застосунку — один на обох. */
    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'typeLabel' => $this->label(),
            'emoji' => self::TYPE_EMOJI[$this->type] ?? '⚠️',
            'ruleCode' => $this->rule_code,
            // Коротка назва порушення ("НРП нік") — з ядра (App\Support\FamilyRules);
            // зі старим ядром без SHORT_LABELS просто null.
            'ruleLabel' => $this->rule_code && method_exists(\App\Support\FamilyRules::class, 'shortLabel')
                ? \App\Support\FamilyRules::shortLabel($this->rule_code) : null,
            'reason' => $this->reason,
            'amount' => $this->amount,
            'originalAmount' => $this->original_amount,
            'status' => $this->status,
            'statusLabel' => self::STATUS_LABELS[$this->status] ?? $this->status,
            'auto' => (bool) $this->auto,
            'dueAt' => $this->due_at?->toIso8601String(),
            'expiresAt' => $this->expires_at?->toIso8601String(),
            'paidAt' => $this->paid_at?->toIso8601String(),
            'paidVia' => $this->paid_via,
            'resolvedAt' => $this->resolved_at?->toIso8601String(),
            'resolutionNote' => $this->resolution_note,
            'createdAt' => $this->created_at?->toIso8601String(),
            'user' => $this->relationLoaded('user') && $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null,
            'author' => $this->relationLoaded('author') && $this->author ? ['id' => $this->author->id, 'name' => $this->author->name] : null,
            'resolver' => $this->relationLoaded('resolver') && $this->resolver ? ['id' => $this->resolver->id, 'name' => $this->resolver->name] : null,
        ];
    }
}
