<?php

namespace Addons\Bonuses\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserInvestmentAchievement extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'user_investment_achievements';

    protected $fillable = ['user_id', 'tier_id', 'earned_at'];

    protected function casts(): array
    {
        return ['earned_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function tier(): BelongsTo
    {
        return $this->belongsTo(InvestmentAchievementTier::class, 'tier_id');
    }
}
