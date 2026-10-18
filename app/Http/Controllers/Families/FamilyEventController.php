<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyEvent;
use App\Models\FamilyEventAttendance;
use App\Models\FamilySeason;
use App\Services\Families\FamilyEvents;
use App\Services\Families\FamilyRating;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FamilyEventController extends FamilyBaseController
{
    public function index(Request $request, Family $family, FamilyEvents $service): Response
    {
        $member = $this->member($request, $family);
        $manage = $this->gate->can($member, $family, 'events.manage');

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
                'capacity' => $e->capacity,
                'seats' => $e->attendance->whereIn('status', [FamilyEventAttendance::STATUS_GOING, FamilyEventAttendance::STATUS_ATTENDED])->count(),
                'waitlist_count' => $e->attendance->where('status', FamilyEventAttendance::STATUS_WAITLIST)->count(),
                'my_status' => $e->attendance->firstWhere('member_id', $member->id)?->status,
                'cover_url' => $e->cover_path !== null ? Storage::disk('public')->url($e->cover_path) : null,
                // Код бачать організатори: його називають усім на початку події.
                'checkin_code' => $manage && $e->status === FamilyEvent::STATUS_PLANNED ? $service->code($e) : null,
                'checkin_open' => $e->status === FamilyEvent::STATUS_PLANNED && now()->between($e->starts_at->copy()->subMinutes(30), $e->starts_at->copy()->addHours(4)),
                'album_url' => $e->album_id !== null ? '/albums/'.$e->album_id : null,
                'can_album' => $e->status === FamilyEvent::STATUS_DONE && ($manage || $e->attendance->contains(fn (FamilyEventAttendance $a) => $a->member_id === $member->id && $a->status === FamilyEventAttendance::STATUS_ATTENDED)),
                'going' => $e->attendance->contains(fn (FamilyEventAttendance $a) => $a->member_id === $member->id && in_array($a->status, [FamilyEventAttendance::STATUS_GOING, FamilyEventAttendance::STATUS_ATTENDED], true)),
                'declined' => $e->attendance->contains(fn (FamilyEventAttendance $a) => $a->member_id === $member->id && $a->status === FamilyEventAttendance::STATUS_DECLINED),
                'declined_count' => $e->attendance->where('status', FamilyEventAttendance::STATUS_DECLINED)->count(),
                // У списку «йдуть» — лише ті, хто не відмовився.
                'attendance' => $e->attendance->reject(fn (FamilyEventAttendance $a) => in_array($a->status, [FamilyEventAttendance::STATUS_DECLINED, FamilyEventAttendance::STATUS_WAITLIST], true))->map(fn (FamilyEventAttendance $a) => [
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
            'weekly' => ['sometimes', 'boolean'],
            'capacity' => ['nullable', 'integer', 'min:2', 'max:500'],
            'cover' => ['nullable', 'image', 'max:5120'],
        ]);

        $description = $data['description'] ?? null;
        $cover = $request->file('cover');
        $events->create($family, $member, [
            'title' => $request->string('title')->toString(),
            'type' => $request->string('type')->toString(),
            'description' => is_string($description) ? $description : null,
            'starts_at' => CarbonImmutable::parse($request->string('starts_at')->toString(), 'Europe/Kyiv')->utc()->toDateTimeString(),
            'points' => isset($data['points']) && is_numeric($data['points']) ? (int) $data['points'] : null,
            'reward' => isset($data['reward']) ? $this->money($data['reward']) : 0,
            'repeat' => ($data['weekly'] ?? false) ? 'weekly' : null,
            'capacity' => isset($data['capacity']) && is_numeric($data['capacity']) ? (int) $data['capacity'] : null,
            'cover' => $cover instanceof UploadedFile ? $cover : null,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Подію створено й анонсовано в чаті сім’ї.']);

        return back();
    }

    public function rsvp(Request $request, Family $family, FamilyEvent $event, FamilyEvents $events): RedirectResponse
    {
        abort_unless($event->family_id === $family->id, 404);
        $member = $this->member($request, $family, write: true);
        $status = $events->rsvp($family, $event, $member, $request->boolean('going'));
        if ($status === FamilyEventAttendance::STATUS_WAITLIST) {
            Inertia::flash('toast', ['type' => 'success', 'message' => 'Місць немає — ви в черзі. Повідомимо, щойно звільниться місце.']);
        }

        return back();
    }

    public function checkIn(Request $request, Family $family, FamilyEvent $event, FamilyEvents $events): RedirectResponse
    {
        abort_unless($event->family_id === $family->id, 404);
        $member = $this->member($request, $family, write: true);
        $data = $request->validate(['code' => ['required', 'string', 'max:6']]);
        $events->checkIn($family, $event, $member, (string) $data['code']);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ви відмітилися на події ✅']);

        return back();
    }

    public function album(Request $request, Family $family, FamilyEvent $event, FamilyEvents $events): RedirectResponse
    {
        abort_unless($event->family_id === $family->id, 404);
        $member = $this->member($request, $family, write: true);
        $attended = FamilyEventAttendance::query()->where('event_id', $event->id)->where('member_id', $member->id)
            ->where('status', FamilyEventAttendance::STATUS_ATTENDED)->exists();
        abort_unless($attended || $this->gate->can($member, $family, 'events.manage'), 403, 'Альбом створюють організатори або присутні.');
        $album = $events->album($family, $event, $member);

        return redirect('/albums/'.$album->id);
    }

    public function close(Request $request, Family $family, FamilyEvent $event, FamilyEvents $events): RedirectResponse
    {
        $member = $this->member($request, $family, 'events.manage', write: true);
        $data = $request->validate([
            'attended' => ['array', 'max:500'],
            'attended.*' => ['integer'],
            'cancelled' => ['sometimes', 'boolean'],
        ]);

        $attended = $data['attended'] ?? [];
        $attendedIds = [];
        if (is_array($attended)) {
            foreach ($attended as $id) {
                $attendedIds[] = is_numeric($id) ? (int) $id : 0;
            }
        }

        $events->close($family, $event, $member, $attendedIds, (bool) ($data['cancelled'] ?? false));
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
            'season' => [
                'number' => (int) FamilySeason::query()->where('family_id', $family->id)->max('number') + 1,
                'started_at' => $family->season_started_at?->toIso8601String(),
                'can_end' => $member->user_id === $family->owner_id,
            ],
            'seasons' => FamilySeason::query()->where('family_id', $family->id)->orderByDesc('number')->limit(12)->get()
                ->map(fn (FamilySeason $s) => [
                    'number' => $s->number,
                    'started_at' => $s->started_at?->toIso8601String(),
                    'ended_at' => $s->ended_at->toIso8601String(),
                    'top' => $s->top,
                ])->values(),
        ]);
    }

    /** Лідер завершує сезон: підсумок зберігається, рахунок сезону обнуляється. */
    public function endSeason(Request $request, Family $family, FamilyRating $rating): RedirectResponse
    {
        $member = $this->member($request, $family, write: true);
        abort_unless($member->user_id === $family->owner_id, 403, 'Завершити сезон може лише лідер сім’ї.');
        $season = $rating->endSeason($family, $member);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Сезон {$season->number} завершено, почався новий."]);

        return back();
    }
}
