<?php

namespace Addons\FamilyGoals\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityEvent extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'activity_events';

    protected $fillable = ['type', 'user_id', 'message'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function log(string $type, ?int $userId, string $message): self
    {
        return self::create(['type' => $type, 'user_id' => $userId, 'message' => $message]);
    }
}
