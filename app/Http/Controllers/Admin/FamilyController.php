<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyReport;
use App\Services\Families\FamilyService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FamilyController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(array_keys(Family::STATUSES))],
            'q' => ['nullable', 'string', 'max:60'],
        ]);
        $status = $filters['status'] ?? Family::STATUS_PENDING;

        $families = Family::query()
            ->with(['server', 'owner'])
            ->withCount(['reports as reports_week' => fn (Builder $q) => $q->where('created_at', '>=', now()->subWeek())])
            ->where('status', $status)
            ->when($filters['q'] ?? null, fn (Builder $q, string $t) => $q->where(fn (Builder $q) => $q->where('name', 'like', "%{$t}%")->orWhere('tag', 'like', "%{$t}%")))
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Family $f) => [
                ...$f->toCard(),
                'description' => $f->description,
                'status_reason' => $f->status_reason,
                'owner' => $f->owner?->toCard(),
                'leader' => FamilyMember::query()->where('family_id', $f->id)->where('user_id', $f->owner_id)->first()?->displayName(),
                'treasury' => $f->treasury,
                'reports_week' => (int) $f->getAttribute('reports_week'),
                'created_at' => $f->created_at->toIso8601String(),
                'verified_at' => $f->verified_at?->toIso8601String(),
            ]);

        return Inertia::render('admin/families', [
            'families' => $families,
            'filters' => ['status' => $status, 'q' => $filters['q'] ?? ''],
            'counts' => collect(array_keys(Family::STATUSES))->mapWithKeys(fn (string $s) => [$s => Family::query()->where('status', $s)->count()]),
            'stats' => [
                'members' => FamilyMember::query()->where('status', FamilyMember::STATUS_ACTIVE)->count(),
                'reports_week' => FamilyReport::query()->where('created_at', '>=', now()->subWeek())->count(),
            ],
            'statuses' => Family::STATUSES,
        ]);
    }

    public function update(Request $request, Family $family, FamilyService $families): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys(Family::STATUSES))],
            'reason' => ['nullable', 'required_if:status,'.Family::STATUS_SUSPENDED, 'string', 'max:300'],
        ], ['reason.required_if' => 'Вкажіть причину призупинення — її побачить лідер.']);

        $families->setStatus($family, $request->user(), $data['status'], $data['reason'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => "[{$family->tag}] {$family->name}: ".Family::STATUSES[$data['status']]]);

        return back();
    }
}
