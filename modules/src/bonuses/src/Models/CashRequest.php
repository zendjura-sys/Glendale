<?php

namespace Addons\Bonuses\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashRequest extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'bank_cash_requests';

    protected $fillable = ['user_id', 'amount', 'status', 'resolved_by', 'resolved_at'];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
