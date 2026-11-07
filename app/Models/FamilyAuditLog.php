<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * Незмінний журнал адміністративних дій сім’ї.
 *
 * @property int $id
 * @property int $family_id
 * @property int|null $actor_user_id
 * @property int|null $actor_member_id
 * @property int|null $target_member_id
 * @property string $action
 * @property array<string, mixed>|null $details
 * @property string|null $ip
 * @property Carbon $created_at
 * @property-read User|null $actorUser
 * @property-read FamilyMember|null $actor
 * @property-read FamilyMember|null $target
 */
#[Fillable(['family_id', 'actor_user_id', 'actor_member_id', 'target_member_id', 'action', 'details', 'ip', 'created_at'])]
class FamilyAuditLog extends Model
{
    public const UPDATED_AT = null;

    public const ACTIONS = [
        'FAMILY_CREATE' => 'Створення сім’ї',
        'FAMILY_UPDATE' => 'Зміна профілю сім’ї',
        'FAMILY_STATUS' => 'Зміна статусу платформою',
        'MEMBER_APPLY' => 'Заявка на вступ',
        'MEMBER_ACCEPT' => 'Прийняття в сім’ю',
        'MEMBER_DECLINE' => 'Відхилення заявки',
        'MEMBER_LEAVE' => 'Вихід із сім’ї',
        'MEMBER_KICK' => 'Виключення',
        'MEMBER_UPDATE' => 'Зміна RP-даних',
        'RANK_UPDATE' => 'Зміна рангу',
        'DUTIES_UPDATE' => 'Обов’язки заступника',
        'RANK_TITLES_UPDATE' => 'Назви рангів',
        'PERMISSIONS_UPDATE' => 'Матриця прав',
        'VOICE_ACCESS_UPDATE' => 'Доступ до голосових кімнат',
        'LISTEN_ROOMS_UPDATE' => 'Кімнати «Слухати разом»',
        'RATE_CHANGE' => 'Зміна ставок і налаштувань',
        'REPORT_APPROVE' => 'Схвалення звіту',
        'REPORT_REJECT' => 'Відхилення звіту',
        'MANUAL_BALANCE_EDIT' => 'Ручна зміна балансу',
        'TREASURY_EDIT' => 'Операція з казною',
        'MONEY_CASHOUT' => 'Виплата в грі',
        'CASHOUT_CANCEL' => 'Скасування виплати',
        'SANCTION_ISSUE' => 'Покарання',
        'SANCTION_REVOKE' => 'Зняття покарання',
        'SANCTION_ESCALATE' => 'Автоескалація',
        'WAREHOUSE_ITEM' => 'Зміна позиції складу',
        'WAREHOUSE_ADJUST' => 'Інвентаризація складу',
        'WAREHOUSE_ALERT' => 'Підозріла активність на складі',
        'EVENT_CREATE' => 'Створення події',
        'EVENT_CLOSE' => 'Підсумок події',
        'WEBHOOKS_UPDATE' => 'Налаштування бота',
        'DIGEST_SENT' => 'Тижневий звіт виплат',
    ];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Журнал аудиту не редагується.'));
        static::deleting(fn () => throw new LogicException('Журнал аудиту не видаляється.'));
    }

    protected function casts(): array
    {
        return ['details' => 'array', 'created_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function actorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'actor_member_id');
    }

    /**
     * @return BelongsTo<FamilyMember, $this>
     */
    public function target(): BelongsTo
    {
        return $this->belongsTo(FamilyMember::class, 'target_member_id');
    }
}
