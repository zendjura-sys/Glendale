<?php

namespace Addons\Progression\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProgressionProfile extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'progression_profiles';

    protected $fillable = [
        'user_id', 'xp', 'current_streak', 'longest_streak',
        'kapt_wins', 'kapt_losses', 'contracts_count', 'heavy_contracts_count',
        'reports_total', 'investment_total', 'last_activity_at',
    ];

    // Явные PHP-дефолты обязательны: firstOrCreate(['user_id' => ...]) без
    // второго аргумента не подтягивает DB-DEFAULT-значения колонок в
    // атрибуты модели — в памяти они остаются null, а не 0, пока объект не
    // перечитан из БД. `null === 0` строго ложно, и именно это ломало
    // проверку "это первая победа" в ProgressionService.
    protected $attributes = [
        'xp' => 0,
        'current_streak' => 0,
        'longest_streak' => 0,
        'kapt_wins' => 0,
        'kapt_losses' => 0,
        'contracts_count' => 0,
        'heavy_contracts_count' => 0,
        'reports_total' => 0,
        'investment_total' => 0,
    ];

    protected function casts(): array
    {
        return ['last_activity_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** floor(sqrt(XP / 250)) + 1 — формула фиксирована брифом. */
    public function level(): int
    {
        return (int) floor(sqrt($this->xp / 250)) + 1;
    }

    // Метод rank() (Recruit/Fighter/.../Officer) отсюда убран намеренно.
    // Это был generic-заголовок из черновика ТЗ ещё до того, как
    // появилась настоящая драбина посад родини (config/family.php,
    // 10 позицій від Стажера до Директора). XP/рівень тут — окремий
    // ігровий лічильник активності, а офіційну посаду показує
    // User::position_title — та сама, що на сайті й у боті.
}
