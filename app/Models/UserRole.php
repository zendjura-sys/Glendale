<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * Роль-плашка користувача з титулом («old», «Big Sponsor»): колір, іконка Lucide, порядок і правило видачі.
 *
 * @property int $id
 * @property string $name
 * @property string $kind regular | holiday | award | premium
 * @property string $color
 * @property string|null $icon
 * @property int $priority менше — показується першою
 * @property string $rule manual | plus | account_years | level | achievement | spent
 * @property string|null $rule_value поріг (роки, рівень, гривні) або ключ досягнення
 * @property string|null $description
 * @property Carbon|null $active_from
 * @property Carbon|null $active_until
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
#[Fillable(['name', 'kind', 'active_from', 'active_until', 'color', 'icon', 'priority', 'rule', 'rule_value', 'description'])]
class UserRole extends Model
{
    /**
     * Види ролей. Ролі команди (адмін, модератор…) живуть у StaffRole, власна роль GameCon+ — у users.plus_title.
     */
    public const KINDS = [
        'regular' => 'Звичайні',
        'holiday' => 'Святкові',
        'award' => 'Нагородні',
        'premium' => 'Преміум',
    ];

    /** Правила видачі: вручну адміністратором або автоматично. */
    public const RULES = [
        'manual' => 'Вручну',
        'plus' => 'Підписка GameCon+',
        'account_years' => 'Стаж акаунта (років)',
        'level' => 'Рівень профілю (від)',
        'achievement' => 'Досягнення',
        'spent' => 'Підтримав GameCon (₴ від)',
    ];

    /** Правила, які перевіряє нічна задача (решта — одразу під час показу). */
    public const SYNCED = ['level', 'achievement', 'spent'];

    /** Іконки, які можна обрати (назви Lucide). */
    public const ICONS = ['crown', 'gem', 'star', 'flame', 'heart', 'shield', 'trophy', 'sparkles', 'zap', 'clock', 'gamepad-2', 'music'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['active_from' => 'date', 'active_until' => 'date'];
    }

    /** Чи діє роль сьогодні (святкові — лише в межах дат). */
    public function activeNow(): bool
    {
        $today = now()->startOfDay();

        return ($this->active_from === null || $this->active_from->lte($today))
            && ($this->active_until === null || $this->active_until->gte($today));
    }

    /**
     * @return BelongsToMany<User, $this>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_role_user')->withPivot(['auto', 'granted_by'])->withTimestamps();
    }

    /**
     * @return array{id: int, name: string, kind: string, color: string, icon: string|null, description: string|null}
     */
    public function toCard(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'kind' => $this->kind, 'color' => $this->color, 'icon' => $this->icon, 'description' => $this->description];
    }
}
