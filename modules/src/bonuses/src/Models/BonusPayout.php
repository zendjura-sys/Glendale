<?php

namespace Addons\Bonuses\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BonusPayout extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'bonus_payouts';

    protected $fillable = [
        'user_id', 'week_start',
        'bizwar_amount', 'bizwar_winrate',
        'contract_amount', 'contracts_count',
        'streak_bonus_amount', 'contracts_count_bonus_amount', 'investment_bonus_amount',
        'discipline_deduction_amount',
        'total_amount',
        'paid', 'paid_at', 'paid_by',
    ];

    protected function casts(): array
    {
        return [
            // НЕ 'date': updateOrCreate() будує WHERE з сирого значення
            // масиву пошуку (без проходження через каст), а create()/save()
            // серіалізує каст-дату в інший рядковий формат — другий прогін
            // того самого тижня не знаходив рядок і падав на unique-
            // обмеженні (user_id, week_start) при спробі вставити дублікат.
            // Тут завжди зберігається й шукається один і той самий рядок
            // (toDateString()), тож каст просто зайвий.
            'bizwar_winrate' => 'decimal:2',
            'paid' => 'boolean',
            'paid_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }
}
