<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyAuditLog;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FamilyAuditController extends FamilyBaseController
{
    public function index(Request $request, Family $family): Response
    {
        $member = $this->member($request, $family, 'audit.view');
        $action = $request->validate(['action' => ['nullable', Rule::in(array_keys(FamilyAuditLog::ACTIONS))]])['action'] ?? null;

        $logs = FamilyAuditLog::query()
            ->with(['actor', 'target', 'actorUser'])
            ->where('family_id', $family->id)
            ->when($action, fn ($q, string $a) => $q->where('action', $a))
            ->latest('id')
            ->paginate(40)
            ->withQueryString()
            ->through(fn (FamilyAuditLog $l) => self::entry($l));

        return $this->page($family, $member, 'families/audit', 'audit', [
            'logs' => Inertia::scroll(fn () => $logs),
            'actions' => FamilyAuditLog::ACTIONS,
            'action' => $action,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public static function entry(FamilyAuditLog $l): array
    {
        return [
            'id' => $l->id,
            'action' => $l->action,
            'action_label' => FamilyAuditLog::ACTIONS[$l->action] ?? $l->action,
            'actor' => $l->actor?->displayName() ?? ($l->actor_user_id && $l->relationLoaded('actorUser') && $l->actorUser ? 'Платформа · '.$l->actorUser->name : ($l->actor_user_id ? null : 'Система')),
            'target' => $l->target?->displayName(),
            'details' => $l->details,
            'created_at' => $l->created_at->toIso8601String(),
        ];
    }
}
