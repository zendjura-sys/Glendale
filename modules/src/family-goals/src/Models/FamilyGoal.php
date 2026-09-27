<?php

namespace Addons\FamilyGoals\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FamilyGoal extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'family_goals';

    /** null — прогрес вручну (як і раніше); інакше рахується сам зі звітів. */
    public const METRICS = [
        'bizwar_wins' => 'Перемоги в бізварі',
        'contracts_count' => 'Виконані контракти',
        'investment_total' => 'Сума інвестицій (₴)',
        'reports_count' => 'Кількість звітів (будь-яких)',
    ];

    protected $fillable = [
        'title', 'description', 'target_value', 'current_value',
        'unit', 'metric', 'deadline', 'status', 'created_by',
    ];

    protected $attributes = [
        'current_value' => 0,
        'status' => 'active',
    ];

    protected function casts(): array
    {
        return ['deadline' => 'date'];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function progressPercent(): ?int
    {
        if (! $this->target_value) {
            return null;
        }

        return (int) min(100, round($this->current_value / $this->target_value * 100));
    }

    /**
     * Автоматичне нарахування (на відміну від updateProgress() в
     * адмінці, який ВСТАНОВЛЮЄ абсолютне значення вручну) — тут завжди
     * ДОДАЄМО суму цього конкретного звіту. Повертає true, якщо саме
     * цим приростом ціль щойно досягнута (адже разом з нею треба
     * залогувати подію й розіслати сповіщення, а не мовчки закрити).
     */
    public function applyIncrement(int $amount): bool
    {
        $this->current_value += $amount;

        $justCompleted = $this->status === 'active'
            && $this->target_value
            && $this->current_value >= $this->target_value;

        if ($justCompleted) {
            $this->status = 'completed';
        }

        $this->save();

        return $justCompleted;
    }
}
