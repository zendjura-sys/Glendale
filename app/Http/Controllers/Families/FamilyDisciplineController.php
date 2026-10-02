<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyPunishment;
use App\Services\Families\Discipline;
use App\Support\Money;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FamilyDisciplineController extends FamilyBaseController
{
    public function index(Request $request, Family $family): Response
    {
        $member = $this->member($request, $family);
        $can = $this->gate->abilities($member, $family);
        $scope = $can['sanctions.issue'] && $request->string('scope')->toString() !== 'me' ? 'family' : 'me';

        $list = FamilyPunishment::query()
            ->with(['member', 'issuer'])
            ->where('family_id', $family->id)
            ->when($scope === 'me', fn ($q) => $q->where('member_id', $member->id))
            ->latest('id')
            ->limit(150)
            ->get()
            ->map(fn (FamilyPunishment $p) => [
                'id' => $p->id,
                'type' => $p->type,
                'type_label' => FamilyPunishment::TYPES[$p->type],
                'reason' => $p->reason,
                'amount' => $p->amount,
                'member' => $p->member->displayName(),
                'member_id' => $p->member_id,
                'issuer' => $p->is_auto ? 'Система' : $p->issuer?->displayName(),
                'is_auto' => $p->is_auto,
                'active' => $p->isActive(),
                'expires_at' => $p->expires_at?->toIso8601String(),
                'revoked_at' => $p->revoked_at?->toIso8601String(),
                'revoke_reason' => $p->revoke_reason,
                'created_at' => $p->created_at->toIso8601String(),
            ]);

        $activeWarns = FamilyPunishment::query()->active()->where('family_id', $family->id)->where('type', FamilyPunishment::TYPE_WARN)
            ->selectRaw('member_id, count(*) as total')->groupBy('member_id')->pluck('total', 'member_id');

        return $this->page($family, $member, 'families/discipline', 'discipline', [
            'scope' => $scope,
            'punishments' => $list,
            'types' => FamilyPunishment::TYPES,
            'config' => $family->resolvedSettings()['discipline'],
            'roster' => $can['sanctions.issue']
                ? FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)
                    ->orderByDesc('rank')->get()
                    ->filter(fn (FamilyMember $m) => $member->outranks($m, $family))
                    ->map(fn (FamilyMember $m) => ['id' => $m->id, 'display' => $m->displayName(), 'rank' => $m->rank, 'warns' => (int) ($activeWarns[$m->id] ?? 0)])
                    ->values()
                : [],
            'my_warns' => (int) ($activeWarns[$member->id] ?? 0),
        ]);
    }

    public function store(Request $request, Family $family, Discipline $discipline): RedirectResponse
    {
        $issuer = $this->member($request, $family, 'sanctions.issue', write: true);
        $data = $request->validate([
            'member_id' => ['required', 'integer'],
            'type' => ['required', Rule::in(array_keys(FamilyPunishment::TYPES))],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
            'amount' => ['nullable', 'required_if:type,fine', 'numeric', 'min:1', 'max:10000000'],
        ], ['amount.required_if' => 'Вкажіть суму штрафу.']);

        $target = FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->findOrFail($request->integer('member_id'));
        $punishment = $discipline->issue($family, $issuer, $target, $data['type'], $data['reason'], isset($data['amount']) ? $this->money($data['amount']) : null);

        $target->refresh();
        $message = FamilyPunishment::TYPES[$punishment->type].' для '.$target->displayName().($punishment->amount ? ' · '.Money::format($punishment->amount) : '');
        if ($punishment->type === FamilyPunishment::TYPE_WARN && $target->status === FamilyMember::STATUS_KICKED) {
            $message .= ' — ліміт попереджень, учасника автоматично виключено.';
        } elseif ($punishment->type === FamilyPunishment::TYPE_WARN && FamilyPunishment::query()->where('member_id', $target->id)->where('is_auto', true)->where('created_at', '>=', now()->subMinute())->exists()) {
            $message .= ' — ліміт попереджень, ранг автоматично знижено.';
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }

    public function revoke(Request $request, Family $family, FamilyPunishment $punishment, Discipline $discipline): RedirectResponse
    {
        $actor = $this->member($request, $family, 'sanctions.issue', write: true);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']]);

        $discipline->revoke($family, $punishment, $actor, $data['reason']);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Покарання знято.']);

        return back();
    }
}
