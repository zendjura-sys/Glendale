<?php

namespace Addons\Bonuses\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Разова премія "вручну" — не пов'язана з тижневим автоматичним розрахунком (BonusPayout). */
class ManualBonusAward extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'bonus_manual_awards';

    protected $fillable = ['user_id', 'amount', 'note', 'awarded_by'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function awardedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'awarded_by');
    }
}
