<?php

namespace Addons\Reports\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Report extends Model
{
    use \App\Families\BelongsToFamily;

    use HasFactory;

    protected $table = 'reports';

    /**
     * 'kapt' лишається тут заради історичних записів (типи звітів, подані
     * до появи бізвару) — але його більше нема у формі подачі, дивись
     * SUBMITTABLE_TYPES.
     */
    public const TYPES = ['kapt', 'contract', 'bizwar', 'investment', 'other'];

    /** Те, що зараз можна вибрати у формі подачі звіту. */
    public const SUBMITTABLE_TYPES = ['contract', 'bizwar', 'investment', 'other'];

    /** Часові слоти капта — погодинно, для майбутнього підрахунку премій. */
    public const KAPT_TIMES = [
        '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00',
        '17:00', '18:00', '19:00', '20:00', '21:00', '22:00',
    ];

    /** Порядок від найвищої до найнижчої — навмисно без "E". */
    public const GRADES = ['S', 'A', 'B', 'C', 'D', 'F', 'G'];

    /** Множник до премії за цю оцінку: +0.3 = +30% до суми звіту. */
    public const GRADE_MODIFIERS = [
        'S' => 0.30,
        'A' => 0.20,
        'B' => 0.10,
        'C' => 0.00,
        'D' => -0.10,
        'F' => -0.20,
        'G' => -0.30,
    ];

    /** Оцінки, для яких причина в адмінці обов'язкова. */
    public const LOW_GRADES = ['D', 'F', 'G'];

    protected $fillable = [
        'user_id', 'submitted_by', 'type', 'report_date',
        'outcome', 'wins_count', 'losses_count', 'kapt_times',
        'weight', 'light_count', 'medium_count', 'heavy_count',
        'amount', 'description', 'status', 'reviewed_by', 'reviewed_at', 'review_note',
        'grade', 'grade_reason',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
            'report_date' => 'date',
            'amount' => 'integer',
            'wins_count' => 'integer',
            'losses_count' => 'integer',
            'kapt_times' => 'array',
            'light_count' => 'integer',
            'medium_count' => 'integer',
            'heavy_count' => 'integer',
        ];
    }

    /** 1.0 = без змін, 1.3 = +30% тощо. */
    public function gradeMultiplier(): float
    {
        return 1 + (self::GRADE_MODIFIERS[$this->grade] ?? 0);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(ReportAttachment::class)->orderBy('position');
    }
}
