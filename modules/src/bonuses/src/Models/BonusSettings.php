<?php

namespace Addons\Bonuses\Models;

use Illuminate\Database\Eloquent\Model;

class BonusSettings extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'bonus_settings';

    protected $fillable = [
        'bizwar_base_rate',
        'contract_light_rate',
        'contract_medium_rate',
        'contract_heavy_rate',
        'streak_threshold',
        'streak_bonus_amount',
        'contracts_count_threshold',
        'contracts_count_bonus_amount',
        'min_digest_amount',
        'transfer_enabled',
        'transfer_daily_limit',
        'transfer_min_amount',
        'deposit_enabled',
        'deposit_interest_rate',
        'deposit_min_amount',
        'deposit_term_days',
    ];

    protected $casts = [
        'transfer_enabled' => 'boolean',
        'deposit_enabled' => 'boolean',
        'deposit_interest_rate' => 'float',
    ];

    /** Один рядок на весь модуль — міграція вже його створює. */
    public static function current(): self
    {
        return self::query()->firstOrCreate([]);
    }
}
