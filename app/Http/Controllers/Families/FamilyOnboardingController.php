<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Services\Families\FamilyAudit;
use App\Services\Families\FamilyNotifier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

/**
 * Анкета для заявки (питання від лідера) і чек-лист новачка (кроки з посиланнями).
 * Зміни — у журнал сім’ї; коли новачок закрив усі кроки, офіцерам приходить сповіщення.
 */
class FamilyOnboardingController extends FamilyBaseController
{
    public const MAX_QUESTIONS = 6;

    public const MAX_STEPS = 10;

    public function update(Request $request, Family $family, FamilyAudit $audit): RedirectResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        $data = $request->validate([
            'questions' => ['present', 'array', 'max:'.self::MAX_QUESTIONS],
            'questions.*.id' => ['nullable', 'string', 'max:12'],
            'questions.*.text' => ['required', 'string', 'min:3', 'max:160'],
            'questions.*.required' => ['boolean'],
            'steps' => ['present', 'array', 'max:'.self::MAX_STEPS],
            'steps.*.id' => ['nullable', 'string', 'max:12'],
            'steps.*.title' => ['required', 'string', 'min:2', 'max:120'],
            'steps.*.url' => ['nullable', 'string', 'max:300', 'regex:#^(https?://|/)#'],
        ], ['steps.*.url.regex' => 'Посилання має починатися з https:// або /.']);

        $questions = array_map(fn (array $q) => [
            'id' => ($q['id'] ?? '') !== '' ? (string) $q['id'] : Str::lower(Str::random(8)),
            'text' => trim($q['text']),
            'required' => (bool) ($q['required'] ?? false),
        ], $data['questions']);
        $steps = array_map(fn (array $s) => [
            'id' => ($s['id'] ?? '') !== '' ? (string) $s['id'] : Str::lower(Str::random(8)),
            'title' => trim($s['title']),
            'url' => isset($s['url']) && trim((string) $s['url']) !== '' ? trim((string) $s['url']) : null,
        ], $data['steps']);

        $family->update(['questions' => array_values($questions), 'onboarding' => array_values($steps)]);
        $audit->log($family, 'ONBOARDING_UPDATE', $member, null, ['questions' => count($questions), 'steps' => count($steps)]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Анкету й чек-лист збережено.']);

        return back();
    }

    /** Відмітити крок чек-листа (або зняти відмітку). */
    public function tick(Request $request, Family $family, string $step, FamilyAudit $audit, FamilyNotifier $notifier): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $ids = array_column($family->onboardingSteps(), 'id');
        abort_unless(in_array($step, $ids, true), 404);

        $done = array_values(array_intersect($ids, (array) $member->onboarding_done));
        $done = in_array($step, $done, true) ? array_values(array_diff($done, [$step])) : [...$done, $step];
        $complete = count(array_intersect($ids, $done)) === count($ids);
        $first = $complete && $member->onboarded_at === null;
        $member->update(['onboarding_done' => $done, 'onboarded_at' => $complete ? ($member->onboarded_at ?? now()) : null]);

        if ($first) {
            $audit->log($family, 'ONBOARDING_DONE', $member, $member, ['steps' => count($ids)]);
            $notifier->holders($family, 'members.manage', 'onboarding', "{$member->displayName()} пройшов(-ла) чек-лист новачка", route('families.members', $family, absolute: false));
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Чек-лист пройдено — ласкаво просимо в сім’ю!']);
        }

        return back();
    }

    /**
     * Картка «Старт новачка» для огляду: кроки з відмітками (показуємо, поки не пройдено, і 30 днів після вступу).
     *
     * @return array<string, mixed>|null
     */
    public static function card(Family $family, FamilyMember $member): ?array
    {
        $steps = $family->onboardingSteps();
        if ($steps === [] || $member->onboarded_at !== null || ($member->joined_at && $member->joined_at->lt(now()->subDays(30)))) {
            return null;
        }
        $done = (array) $member->onboarding_done;

        return [
            'steps' => array_map(fn (array $s) => [...$s, 'done' => in_array($s['id'], $done, true)], $steps),
        ];
    }
}
