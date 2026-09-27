<?php

namespace App\Http\Controllers\Admin;

use App\Families\FamilyContext;
use App\Families\FamilyPositions;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\FamilyContent;
use App\Support\FamilyRules;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * «Профіль родини» — керування родиною для її лідера й заступників:
 * опис, структура керівництва, посади й критерії підвищення, правила
 * родини, а також хто на якій посаді. Усе — в межах активної родини.
 */
class FamilyProfileController extends Controller
{
    public function index(): Response
    {
        $family = FamilyContext::family();
        abort_unless($family, 404);

        $members = DB::table('family_members as m')->join('users as u', 'u.id', '=', 'm.user_id')
            ->where('m.family_id', $family->id)
            ->orderByRaw("CASE m.role WHEN 'leader' THEN 0 WHEN 'deputy' THEN 1 ELSE 2 END")->orderBy('u.name')
            ->get(['u.id', 'u.name', 'm.role', 'm.position_key'])
            ->map(fn ($m) => ['id' => $m->id, 'name' => $m->name, 'role' => $m->role, 'positionKey' => $m->position_key])->all();

        return Inertia::render('Admin/FamilyProfile/Index', [
            'family' => ['id' => $family->id, 'name' => $family->name, 'tag' => $family->tag, 'project' => $family->project, 'server' => $family->server],
            'content' => [
                'about' => FamilyContent::about(),
                'leadership' => FamilyContent::leadership(),
                'positions' => FamilyContent::positions(),
                'promotionCriteria' => FamilyContent::promotionCriteria(),
            ],
            'rules' => FamilyRules::familyMarkdown(),
            'members' => $members,
        ]);
    }

    public function updateContent(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'about' => ['present', 'array', 'max:10'],
            'about.*' => ['nullable', 'string', 'max:600'],
            'leadership' => ['present', 'array', 'max:24'],
            'leadership.*.title' => ['required', 'string', 'max:80'],
            'leadership.*.text' => ['nullable', 'string', 'max:400'],
            'leadership.*.nickname' => ['nullable', 'string', 'max:40'],
            'positions' => ['present', 'array', 'min:1', 'max:24'],
            'positions.*.key' => ['nullable', 'string', 'max:80'],
            'positions.*.title' => ['required', 'string', 'max:80'],
            'positions.*.text' => ['nullable', 'string', 'max:400'],
            'positions.*.image' => ['nullable', 'string', 'max:200'],
            'promotionCriteria' => ['present', 'array', 'max:20'],
            'promotionCriteria.*' => ['nullable', 'string', 'max:160'],
        ]);

        foreach (['about', 'leadership', 'positions'] as $key) {
            FamilyContent::save($key, $data[$key]);
        }
        FamilyContent::save('promotion_criteria', $data['promotionCriteria']);

        // Посаду, якої більше немає, знімаємо з учасників — не лишаємо «висячий» ключ.
        $keys = FamilyContent::positionKeys();
        DB::table('family_members')->where('family_id', FamilyContext::id())
            ->whereNotNull('position_key')->whereNotIn('position_key', $keys)->update(['position_key' => null]);
        FamilyPositions::flush();

        return back()->with('status', 'Профіль родини збережено.');
    }

    public function updateRules(Request $request): RedirectResponse
    {
        $data = $request->validate(['rules' => ['nullable', 'string', 'max:60000']]);
        FamilyRules::saveFamilyMarkdown($data['rules'] ?? null);

        return back()->with('status', 'Правила родини збережено.');
    }

    public function updatePosition(Request $request, int $user): RedirectResponse
    {
        $data = $request->validate(['positionKey' => ['nullable', 'string', 'in:'.implode(',', FamilyContent::positionKeys())]]);
        $familyId = FamilyContext::id();
        abort_unless(DB::table('family_members')->where('family_id', $familyId)->where('user_id', $user)->exists(), 404);

        FamilyPositions::set($familyId, $user, $data['positionKey'] ?? null);
        // У першій родині (Monsory) стара колонка лишається синхронною.
        if ($familyId === FamilyContext::defaultId()) {
            DB::table('users')->where('id', $user)->update(['position_key' => $data['positionKey'] ?? null]);
        }

        return back()->with('status', 'Посаду змінено.');
    }
}
