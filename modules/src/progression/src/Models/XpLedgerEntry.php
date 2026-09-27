<?php

namespace Addons\Progression\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class XpLedgerEntry extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'xp_ledger';

    public $timestamps = false; // только created_at, апенд-лог не обновляется

    protected $fillable = ['user_id', 'amount', 'reason', 'source_type', 'source_id', 'awarded_by', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $entry) {
            $entry->created_at ??= now();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
