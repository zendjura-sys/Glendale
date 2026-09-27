<?php

namespace Addons\MemberCenter\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberProfile extends Model
{
    use \App\Families\BelongsToFamily;

    protected $table = 'member_profiles';

    protected $fillable = ['user_id', 'hr_status'];

    protected $attributes = [
        'hr_status' => 'active',
    ];

    public const STATUSES = ['active', 'probation', 'leave', 'inactive'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
