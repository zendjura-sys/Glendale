<?php

namespace App\Services\Families;

use App\Models\Family;
use App\Models\FamilyAuditLog;
use App\Models\FamilyMember;
use App\Models\User;

class FamilyAudit
{
    /**
     * @param  array<string, mixed>  $details
     */
    public function log(Family $family, string $action, ?FamilyMember $actor, ?FamilyMember $target = null, array $details = [], ?User $actorUser = null): FamilyAuditLog
    {
        return FamilyAuditLog::query()->create([
            'family_id' => $family->id,
            'actor_user_id' => $actorUser?->id ?? $actor?->user_id,
            'actor_member_id' => $actor?->id,
            'target_member_id' => $target?->id,
            'action' => $action,
            'details' => $details ?: null,
            'ip' => app()->runningInConsole() ? null : request()->ip(),
            'created_at' => now(),
        ]);
    }
}
