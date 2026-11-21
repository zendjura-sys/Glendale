<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Services\Families\FamilyAudit;
use App\Services\Families\WeeklyGoals;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/** Налаштування → Тижневі завдання сім’ї (до трьох цілей з нагородою). */
class FamilyGoalsController extends FamilyBaseController
{
    public function update(Request $request, Family $family, WeeklyGoals $goals, FamilyAudit $audit): RedirectResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        $data = $request->validate([
            'goals' => ['present', 'array', 'max:'.WeeklyGoals::MAX],
            'goals.*.id' => ['nullable', 'string', 'max:12'],
            'goals.*.type' => ['required', Rule::in(array_keys(WeeklyGoals::TYPES))],
            'goals.*.target' => ['required', 'integer', 'min:1', 'max:100000'],
            'goals.*.reward' => ['nullable', 'string', 'max:120'],
        ]);
        $goals->save($family, $data['goals']);
        $audit->log($family, 'GOALS_UPDATE', $member, null, ['goals' => count($data['goals'])]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Тижневі завдання збережено.']);

        return back();
    }
}
