<?php

namespace Addons\Bonuses\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BankDeposit extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'bank_deposits';

    protected $fillable = [
        'user_id', 'amount', 'interest_rate', 'term_days', 'matures_at',
        'status', 'payout_amount', 'closed_at',
    ];

    protected $casts = [
        'matures_at' => 'datetime',
        'closed_at' => 'datetime',
        'interest_rate' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Прогнозована сума повернення, якщо дозріє за планом (для відображення, поки active). */
    public function projectedPayout(): int
    {
        return $this->amount + (int) floor($this->amount * $this->interest_rate / 100);
    }
}
