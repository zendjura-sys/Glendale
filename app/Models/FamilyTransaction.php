<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * Запис банківської книги. Незмінний: виправлення робляться новою операцією.
 *
 * @property int $id
 * @property int $family_id
 * @property int|null $member_id
 * @property string $type
 * @property int $amount
 * @property int|null $balance_after
 * @property int $treasury_delta
 * @property int|null $treasury_after
 * @property int|null $actor_id
 * @property string|null $comment
 * @property string|null $subject_type
 * @property int|null $subject_id
 * @property Carbon $created_at
 * @property-read FamilyMember|null $member
 * @property-read FamilyMember|null $actor
 */
#[Fillable(['family_id', 'member_id', 'type', 'amount', 'balance_after', 'treasury_delta', 'treasury_after', 'actor_id', 'comment', 'subject_type', 'subject_id', 'created_at'])]
class FamilyTransaction extends Model
{
    public const UPDATED_AT = null;

    public const TYPES = [
        'report_reward' => 'Нарахування за звіт',
        'event_reward' => 'Нагорода за подію',
        'deposit_open' => 'Відкриття депозиту',
        'deposit_payout' => 'Повернення депозиту',
        'deposit_interest' => 'Відсотки за депозитом',
        'deposit_close' => 'Дострокове закриття депозиту',
        'cashout_hold' => 'Заявка на виведення',
        'cashout_refund' => 'Повернення заявки',
        'cashout_paid' => 'Виведено в грі',
        'fine' => 'Штраф',
        'fine_refund' => 'Скасування штрафу',
        'manual_credit' => 'Ручне нарахування',
        'manual_debit' => 'Ручне списання',
        'treasury_in' => 'Поповнення казни',
        'treasury_out' => 'Витрата з казни',
        'investment' => 'Інвестиція в казну',
    ];

    /** Операції, що вважаються заробітком у тижневому звіті. */
    public const EARNINGS = ['report_reward', 'event_reward', 'manual_credit', 'deposit_interest'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Банківські операції не редагуються.'));
        static::deleting(fn () => throw new LogicException('Банківські операції не видаляються.'));
    }

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'treasury_delta' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'member_id');
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'actor_id');
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
