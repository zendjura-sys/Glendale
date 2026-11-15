<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyReport;
use App\Models\FamilyShift;
use App\Models\FamilyShiftPartner;
use App\Services\Families\FamilyAudit;
use App\Services\Families\FamilyNotifier;
use App\Services\Families\ShiftGoals;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Календар змін і чергувань: тиждень із днями, створення (з повтором на кілька тижнів),
 * призначення учасника, «Взяти зміну» й «Віддати». Хто взяв зміну — бригадир: інші просяться
 * в напарники, бригадир (або керівництво) схвалює. Кожна дія — у журнал сім’ї.
 */
class FamilyShiftController extends FamilyBaseController
{
    public function index(Request $request, Family $family, ShiftGoals $goals): Response
    {
        $member = $this->member($request, $family);
        $tz = 'Europe/Kyiv';
        $offset = max(-8, min(12, (int) $request->query('week', 0)));
        $start = CarbonImmutable::now($tz)->startOfWeek()->addWeeks($offset);
        $end = $start->addWeek();

        $manage = $this->gate->can($member, $family, 'events.manage');
        $shifts = FamilyShift::query()->with(['member', 'partners.member'])->where('family_id', $family->id)
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
                // Напарники: бригадир і керівництво бачать заявки, решта — лише схвалених.
                'partners' => $s->partners
                    ->filter(fn (FamilyShiftPartner $p) => $p->status === FamilyShiftPartner::APPROVED || $s->member_id === $member->id || $manage || $p->member_id === $member->id)
                    ->map(fn (FamilyShiftPartner $p) => [
                        'id' => $p->id,
                        'member_id' => $p->member_id,
                        'display' => $p->member?->displayName(),
                        'status' => $p->status,
                        'me' => $p->member_id === $member->id,
                        // Завдання кожен виконує сам — свій прогрес у кожного напарника.
                        'goal' => $s->goal && $p->status === FamilyShiftPartner::APPROVED ? [
                            'progress' => $p->completed_at ? max($p->progress, (int) $s->goal['count']) : min((int) $s->goal['count'], $goals->progressFor($s, $p->member_id)),
                            'done' => $p->completed_at !== null,
                        ] : null,
                    ])
                    ->values(),
                'partner' => $s->partners->firstWhere('member_id', $member->id)?->status,
                'can_lead' => $s->member_id !== null && ($s->member_id === $member->id || $manage),
                'can_join' => $s->member_id !== null && $s->member_id !== $member->id && ! $s->ends_at->isPast()
                    && $s->partners->firstWhere('member_id', $member->id) === null && $s->partners->count() < FamilyShiftPartner::LIMIT,
                // Завдання зміни: прогрес зі схвалених звітів (рахуємо наживо, поки зміна не закрита).
                'goal' => $s->goal ? [
                    'label' => ShiftGoals::label($s->goal),
                    'count' => (int) $s->goal['count'],
                    'progress' => $s->completed_at ? max($s->progress, (int) $s->goal['count']) : min((int) $s->goal['count'], $goals->progress($s)),
                    'done' => $s->completed_at !== null,
                    'missed' => $s->completed_at === null && $s->ends_at->copy()->addHours(ShiftGoals::GRACE_HOURS)->isPast(),
                ] : null,
            ])->values();

        return $this->page($family, $member, 'families/shifts', 'shifts', [
            'week' => ['offset' => $offset, 'start' => $start->toDateString()],
            'shifts' => $shifts,
            'roster' => $this->roster($family),
            'rules' => [
                'self_claim' => (bool) $family->setting('shifts.self_claim', true),
                'week_limit' => (int) $family->setting('shifts.week_limit', 0),
                'remind' => (bool) $family->setting('shifts.remind', true),
            ],
            'goal_types' => ShiftGoals::TYPES,
            'tiers' => FamilyReport::TIERS,
            'my_week' => FamilyShift::query()->where('family_id', $family->id)->where('member_id', $member->id)
                ->where('starts_at', '>=', $start->utc())->where('starts_at', '<', $end->utc())->count(),
        ]);
    }

    public function store(Request $request, Family $family, FamilyAudit $audit): RedirectResponse
    {
        $actor = $this->member($request, $family, 'events.manage', write: true);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:80'],
            'note' => ['nullable', 'string', 'max:200'],
            'starts_at' => ['required', 'date'],
            'hours' => ['required', 'numeric', 'min:0.5', 'max:24'],
            'member_id' => ['nullable', 'integer'],
            'repeat_weeks' => ['nullable', 'integer', 'min:1', 'max:8'],
            'goal_type' => ['nullable', Rule::in(array_keys(ShiftGoals::TYPES))],
            'goal_tier' => ['nullable', Rule::in(array_keys(FamilyReport::TIERS))],
            'goal_count' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);
        $goal = ShiftGoals::normalize($data['goal_type'] ?? null, $data['goal_tier'] ?? null, isset($data['goal_count']) ? (int) $data['goal_count'] : null);
        $assignee = $this->assignee($family, $data['member_id'] ?? null);
        $start = CarbonImmutable::parse($data['starts_at'], 'Europe/Kyiv')->utc();
        $minutes = (int) round((float) $data['hours'] * 60);
        $weeks = (int) ($data['repeat_weeks'] ?? 1);
        DB::transaction(function () use ($family, $actor, $data, $assignee, $start, $minutes, $weeks, $goal) {
            for ($w = 0; $w < $weeks; $w++) {
                $from = $start->addWeeks($w);
                FamilyShift::query()->create([
                    'family_id' => $family->id,
                    'title' => trim($data['title']),
                    'note' => isset($data['note']) ? trim($data['note']) : null,
                    'goal' => $goal,
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
        abort_unless($shift->family_id === $family->id, 404);
        $assignee = $this->assignee($family, $request->integer('member_id') ?: null);
        $shift->update(['member_id' => $assignee?->id]);
        if ($assignee === null) {
            $shift->partners()->delete();
        } else {
            $shift->partners()->where('member_id', $assignee->id)->delete();
        }
        $audit->log($family, 'SHIFT_ASSIGN', $actor, $assignee, ['shift_id' => $shift->id, 'title' => $shift->title]);

        return back();
    }

    /** Взяти вільну зміну собі. */
    public function claim(Request $request, Family $family, FamilyShift $shift, FamilyAudit $audit): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        abort_unless($shift->family_id === $family->id, 404);
        abort_if($shift->member_id !== null, 422, 'Зміну вже хтось узяв.');
        abort_if($shift->ends_at->isPast(), 422, 'Зміна вже минула.');
        abort_unless((bool) $family->setting('shifts.self_claim', true) || $this->gate->can($member, $family, 'events.manage'), 403, 'Зміни в цій сім’ї призначає керівництво.');
        $limit = (int) $family->setting('shifts.week_limit', 0);
        if ($limit > 0) {
            $from = $shift->starts_at->copy()->timezone('Europe/Kyiv')->startOfWeek()->utc();
            $taken = FamilyShift::query()->where('family_id', $family->id)->where('member_id', $member->id)
                ->where('starts_at', '>=', $from)->where('starts_at', '<', $from->copy()->addWeek())->count();
            abort_if($taken >= $limit, 422, "Ліміт сім’ї — {$limit} змін на тиждень.");
        }
        $shift->update(['member_id' => $member->id]);
        $audit->log($family, 'SHIFT_CLAIM', $member, null, ['shift_id' => $shift->id, 'title' => $shift->title]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Зміна ваша.']);

        return back();
    }

    /** Віддати свою зміну — вона знову вільна. */
    public function release(Request $request, Family $family, FamilyShift $shift, FamilyAudit $audit, FamilyNotifier $notifier): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        abort_unless($shift->family_id === $family->id && $shift->member_id === $member->id, 403);
        abort_if($shift->starts_at->isPast(), 422, 'Зміна вже почалась — домовтеся з керівництвом.');
        // Є схвалені напарники — бригадиром стає перший із них, інакше зміна знову вільна.
        $next = $shift->partners()->where('status', FamilyShiftPartner::APPROVED)->orderBy('approved_at')->first();
        DB::transaction(function () use ($shift, $next) {
            if ($next !== null) {
                // Прогрес завдання — особистий, тож новий бригадир зберігає свій.
                $shift->update(['member_id' => $next->member_id, 'progress' => $next->progress, 'completed_at' => $next->completed_at]);
                $next->delete();
            } else {
                $shift->update(['member_id' => null, 'progress' => 0, 'completed_at' => null]);
                $shift->partners()->delete();
            }
        });
        $audit->log($family, 'SHIFT_RELEASE', $member, $next?->member, ['shift_id' => $shift->id, 'title' => $shift->title]);
        if ($next?->member) {
            $notifier->members($next->member, $family, 'shift', "Ви тепер бригадир зміни «{$shift->title}»", route('families.shifts', $family, absolute: false));
        }

        return back();
    }

    /** Попроситися в напарники до бригадира зміни. */
    public function join(Request $request, Family $family, FamilyShift $shift, FamilyAudit $audit, FamilyNotifier $notifier): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        abort_unless($shift->family_id === $family->id, 404);
        abort_if($shift->member_id === null, 422, 'Зміна вільна — просто візьміть її.');
        abort_if($shift->member_id === $member->id, 422, 'Ви вже бригадир цієї зміни.');
        abort_if($shift->ends_at->isPast(), 422, 'Зміна вже минула.');
        abort_if($shift->partners()->where('member_id', $member->id)->exists(), 422, 'Заявку вже подано.');
        abort_if($shift->partners()->count() >= FamilyShiftPartner::LIMIT, 422, 'На зміні вже повна бригада.');
        $shift->partners()->create(['member_id' => $member->id, 'status' => FamilyShiftPartner::PENDING]);
        $audit->log($family, 'SHIFT_PARTNER_REQUEST', $member, $shift->member, ['shift_id' => $shift->id, 'title' => $shift->title]);
        if ($shift->member) {
            $notifier->members($shift->member, $family, 'shift', "{$member->displayName()} проситься в напарники на зміну «{$shift->title}»", route('families.shifts', $family, absolute: false));
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку надіслано бригадиру.']);

        return back();
    }

    /** Бригадир чи керівництво схвалює або відхиляє напарника. */
    public function partner(Request $request, Family $family, FamilyShift $shift, FamilyShiftPartner $partner, FamilyAudit $audit, FamilyNotifier $notifier): RedirectResponse
    {
        $actor = $this->member($request, $family, write: true);
        abort_unless($shift->family_id === $family->id && $partner->shift_id === $shift->id, 404);
        abort_unless($shift->member_id === $actor->id || $this->gate->can($actor, $family, 'events.manage'), 403, 'Напарників схвалює бригадир зміни.');
        $accept = $request->boolean('accept');
        $target = $partner->member;
        if ($accept) {
            $partner->update(['status' => FamilyShiftPartner::APPROVED, 'approved_at' => now()]);
        } else {
            $partner->delete();
        }
        $audit->log($family, $accept ? 'SHIFT_PARTNER_APPROVE' : 'SHIFT_PARTNER_DECLINE', $actor, $target, ['shift_id' => $shift->id, 'title' => $shift->title]);
        if ($target) {
            $notifier->members($target, $family, 'shift', $accept ? "Вас узяли напарником на зміну «{$shift->title}»" : "Бригадир не взяв вас на зміну «{$shift->title}»", route('families.shifts', $family, absolute: false));
        }

        return back();
    }

    /** Напарник виходить зі зміни (або скасовує заявку). */
    public function leave(Request $request, Family $family, FamilyShift $shift, FamilyAudit $audit): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        abort_unless($shift->family_id === $family->id, 404);
        $partner = $shift->partners()->where('member_id', $member->id)->firstOrFail();
        $partner->delete();
        $audit->log($family, 'SHIFT_PARTNER_LEAVE', $member, $shift->member, ['shift_id' => $shift->id, 'title' => $shift->title]);

        return back();
    }

    public function destroy(Request $request, Family $family, FamilyShift $shift, FamilyAudit $audit): RedirectResponse
    {
        $actor = $this->member($request, $family, 'events.manage', write: true);
        abort_unless($shift->family_id === $family->id, 404);
        $audit->log($family, 'SHIFT_DELETE', $actor, null, ['shift_id' => $shift->id, 'title' => $shift->title, 'starts_at' => $shift->starts_at->toIso8601String()]);
        $shift->delete();

        return back();
    }

    private function assignee(Family $family, ?int $memberId): ?FamilyMember
    {
        if ($memberId === null) {
            return null;
        }

        return FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->whereKey($memberId)->firstOrFail();
    }
}
