<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Services\Families\FamilyEvents;
use App\Services\Families\FamilyRating;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FamilyEventController extends FamilyBaseController
{
    public function index(Request $request, Family $family): Response
    {
        $member = $this->member($request, $family);

        $events = FamilyEvent::query()
            ->with(['attendance.member', 'creator'])
            ->where('family_id', $family->id)
            ->orderByRaw("case when status = 'planned' then 0 else 1 end")
            ->orderByRaw("case when status = 'planned' then starts_at end asc")
            ->orderByDesc('starts_at')
            ->limit(60)
            ->get()
            ->map(fn (FamilyEvent $e) => [
                'id' => $e->id,
                'title' => $e->title,
                'type' => $e->type,
                'type_label' => FamilyEvent::TYPES[$e->type],
                'description' => $e->description,
                'starts_at' => $e->starts_at->toIso8601String(),
                'points' => $e->points,
                'reward' => $e->reward,
                'status' => $e->status,
                'creator' => $e->creator?->displayName(),
                'going' => $e->attendance->contains('member_id', $member->id),
                'attendance' => $e->attendance->map(fn (FamilyEventAttendance $a) => [
                    'member_id' => $a->member_id,
                    'display' => $a->member->displayName(),
                    'status' => $a->status,
                ])->values(),
            ]);

        return $this->page($family, $member, 'families/events', 'events', [
            'events' => $events,
            'types' => FamilyEvent::TYPES,
            'roster' => $this->roster($family),
            'default_points' => (int) $family->setting('rating.points_event', 5),
        ]);
    }

    public function store(Request $request, Family $family, FamilyEvents $events): RedirectResponse
    {
        $member = $this->member($request, $family, 'events.manage', write: true);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in(array_keys(FamilyEvent::TYPES))],
            'description' => ['nullable', 'string', 'max:1000'],
            'starts_at' => ['required', 'date', 'after:-1 day'],
            'points' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'reward' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
        ]);

        $events->create($family, $member, [
            ...$data,
            'starts_at' => CarbonImmutable::parse($data['starts_at'], 'Europe/Kyiv')->utc(),
            'reward' => isset($data['reward']) ? $this->money($data['reward']) : 0,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подію створено й анонсовано в чаті сім’ї.']);

        return back();
    }

    public function rsvp(Request $request, Family $family, FamilyEvent $event, FamilyEvents $events): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        $events->rsvp($family, $event, $member, $request->boolean('going'));

        return back();
    }

    public function close(Request $request, Family $family, FamilyEvent $event, FamilyEvents $events): RedirectResponse
    {
        $member = $this->member($request, $family, 'events.manage', write: true);
        $data = $request->validate([
            'attended' => ['array', 'max:500'],
            'attended.*' => ['integer'],
            'cancelled' => ['sometimes', 'boolean'],
        ]);

        $events->close($family, $event, $member, array_map('intval', $data['attended'] ?? []), (bool) ($data['cancelled'] ?? false));
        Inertia::flash('toast', ['type' => 'success', 'message' => ($data['cancelled'] ?? false) ? 'Подію скасовано.' : 'Підсумок збережено: бали й нагороди нараховано.']);

        return back();
    }

    public function rating(Request $request, Family $family, FamilyRating $rating): Response
    {
        $member = $this->member($request, $family);
        $period = $request->validate(['period' => ['nullable', Rule::in(array_keys(FamilyRating::PERIODS))]])['period'] ?? 'week';

        return $this->page($family, $member, 'families/rating', 'rating', [
            'period' => $period,
            'periods' => FamilyRating::PERIODS,
            'leaderboard' => $rating->leaderboard($family, $period),
            'config' => $family->resolvedSettings()['rating'],
        ]);
    }
}
