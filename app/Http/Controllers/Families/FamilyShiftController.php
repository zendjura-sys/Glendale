<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyShift;
use App\Services\Families\FamilyAudit;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Календар змін і чергувань: тиждень із днями, створення (з повтором на кілька тижнів),
 * призначення учасника, «Взяти зміну» й «Віддати». Кожна дія — у журнал сім’ї.
 */
class FamilyShiftController extends FamilyBaseController
{
    public function index(Request $request, Family $family): Response
    {
        $member = $this->member($request, $family);
        $this->enabled($family);
        $tz = 'Europe/Kyiv';
        $offset = max(-8, min(12, (int) $request->query('week', 0)));
        $start = CarbonImmutable::now($tz)->startOfWeek()->addWeeks($offset);
        $end = $start->addWeek();

        $shifts = FamilyShift::query()->with('member')->where('family_id', $family->id)
            ->where('starts_at', '>=', $start->utc())->where('starts_at', '<', $end->utc())
            ->orderBy('starts_at')->get()
            ->map(fn (FamilyShift $s) => [
                'id' => $s->id,
                'title' => $s->title,
                'note' => $s->note,
                'starts_at' => $s->starts_at->toIso8601String(),
                'ends_at' => $s->ends_at->toIso8601String(),
                'member' => $s->member ? ['id' => $s->member->id, 'display' => $s->member->displayName()] : null,
                'mine' => $s->member_id === $member->id,
            ])->values();

        return $this->page($family, $member, 'families/shifts', 'shifts', [
            'week' => ['offset' => $offset, 'start' => $start->toDateString()],
            'shifts' => $shifts,
            'roster' => $this->roster($family),
            'my_week' => FamilyShift::query()->where('family_id', $family->id)->where('member_id', $member->id)
                ->where('starts_at', '>=', $start->utc())->where('starts_at', '<', $end->utc())->count(),
        ]);
    }

    public function store(Request $request, Family $family, FamilyAudit $audit): RedirectResponse
    {
        $actor = $this->member($request, $family, 'events.manage', write: true);
        $this->enabled($family);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:80'],
            'note' => ['nullable', 'string', 'max:200'],
            'starts_at' => ['required', 'date'],
            'hours' => ['required', 'numeric', 'min:0.5', 'max:24'],
            'member_id' => ['nullable', 'integer'],
            'repeat_weeks' => ['nullable', 'integer', 'min:1', 'max:8'],
        ]);
        $assignee = $this->assignee($family, $data['member_id'] ?? null);
        $start = CarbonImmutable::parse($data['starts_at'], 'Europe/Kyiv')->utc();
        $minutes = (int) round((float) $data['hours'] * 60);
        $weeks = (int) ($data['repeat_weeks'] ?? 1);
        DB::transaction(function () use ($family, $actor, $data, $assignee, $start, $minutes, $weeks) {
            for ($w = 0; $w < $weeks; $w++) {
                $from = $start->addWeeks($w);
                FamilyShift::query()->create([
                    'family_id' => $family->id,
                    'title' => trim($data['title']),
                    'note' => isset($data['note']) ? trim($data['note']) : null,
                    'starts_at' => $from,
                    'ends_at' => $from->addMinutes($minutes),
                    'member_id' => $assignee?->id,
                    'created_by' => $actor->id,
                ]);
            }
        });
        $audit->log($family, 'SHIFT_CREATE', $actor, $assignee, ['title' => $data['title'], 'weeks' => $weeks]);
        Inertia::flash('toast', ['type' => 'success', 'message' => $weeks > 1 ? "Зміни додано на {$weeks} тижн." : 'Зміну додано.']);

        return back();
    }

    /** Призначити учасника (керівництво) — або зняти призначення (member_id = null). */
    public function assign(Request $request, Family $family, FamilyShift $shift, FamilyAudit $audit): RedirectResponse
    {
        $actor = $this->member($request, $family, 'events.manage', write: true);
        $this->enabled($family);
        abort_unless($shift->family_id === $family->id, 404);
        $assignee = $this->assignee($family, $request->integer('member_id') ?: null);
        $shift->update(['member_id' => $assignee?->id]);
        $audit->log($family, 'SHIFT_ASSIGN', $actor, $assignee, ['shift_id' => $shift->id, 'title' => $shift->title]);

        return back();
    }

    /** Взяти вільну зміну собі. */
    public function claim(Request $request, Family $family, FamilyShift $shift, FamilyAudit $audit): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $this->enabled($family);
        abort_unless($shift->family_id === $family->id, 404);
        abort_if($shift->member_id !== null, 422, 'Зміну вже хтось узяв.');
        abort_if($shift->ends_at->isPast(), 422, 'Зміна вже минула.');
        $shift->update(['member_id' => $member->id]);
        $audit->log($family, 'SHIFT_CLAIM', $member, null, ['shift_id' => $shift->id, 'title' => $shift->title]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Зміна ваша.']);

        return back();
    }

    /** Віддати свою зміну — вона знову вільна. */
    public function release(Request $request, Family $family, FamilyShift $shift, FamilyAudit $audit): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $this->enabled($family);
        abort_unless($shift->family_id === $family->id && $shift->member_id === $member->id, 403);
        abort_if($shift->starts_at->isPast(), 422, 'Зміна вже почалась — домовтеся з керівництвом.');
        $shift->update(['member_id' => null]);
        $audit->log($family, 'SHIFT_RELEASE', $member, null, ['shift_id' => $shift->id, 'title' => $shift->title]);

        return back();
    }

    public function destroy(Request $request, Family $family, FamilyShift $shift, FamilyAudit $audit): RedirectResponse
    {
        $actor = $this->member($request, $family, 'events.manage', write: true);
        $this->enabled($family);
        abort_unless($shift->family_id === $family->id, 404);
        $audit->log($family, 'SHIFT_DELETE', $actor, null, ['shift_id' => $shift->id, 'title' => $shift->title, 'starts_at' => $shift->starts_at->toIso8601String()]);
        $shift->delete();

        return back();
    }

    /** Лідер може вимкнути «Зміни» в налаштуваннях сім’ї. */
    private function enabled(Family $family): void
    {
        abort_unless((bool) $family->setting('shifts.enabled', true), 404, 'Розділ «Зміни» в цій сім’ї вимкнено.');
    }

    private function assignee(Family $family, ?int $memberId): ?FamilyMember
    {
        if ($memberId === null) {
            return null;
        }

        return FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->whereKey($memberId)->firstOrFail();
    }
}
