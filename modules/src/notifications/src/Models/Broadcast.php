<?php

namespace Addons\Notifications\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Broadcast extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'broadcasts';

    protected $fillable = [
        'title', 'body', 'pinned', 'audience_type', 'audience_value', 'recipients_count', 'created_by',
    ];

    protected function casts(): array
    {
        return ['pinned' => 'boolean'];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(BroadcastDelivery::class);
    }

    /** @return array{sent:int,failed:int,pending:int} */
    public function deliveryStats(): array
    {
        $counts = $this->deliveries()->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');

        return [
            'sent' => (int) ($counts['sent'] ?? 0),
            'failed' => (int) ($counts['failed'] ?? 0),
            'pending' => (int) ($counts['pending'] ?? 0),
        ];
    }
}
