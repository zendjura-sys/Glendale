<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyRelation;
use App\Models\FamilyReport;
use App\Models\FamilySeason;
use App\Services\Families\FamilyAudit;
use App\Services\Families\FamilyNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Союзи й війни сімей на сервері + історія сім’ї з досягненнями.
 * Союз пропонує лідер, друга сім’я приймає; війну оголошують одразу. Кожна дія — в аудит обох сімей.
 */
class FamilyRelationController extends FamilyBaseController
{
    public function index(Request $request, Family $family): Response|JsonResponse
    {
        $member = $this->member($request, $family);
        $can = $this->gate->abilities($member, $family);
        $relations = $this->relations($family)->map(fn (FamilyRelation $r) => $this->card($family, $r))->values();
        $data = [
            'relations' => $relations,
            'can_manage' => (bool) ($can['settings.manage'] ?? false),
            // Інші сім’ї того самого сервера — кого можна запросити в союз чи кому оголосити війну.
            'candidates' => ($can['settings.manage'] ?? false) && $family->server_id
                ? Family::query()->where('server_id', $family->server_id)->whereKeyNot($family->id)->orderBy('name')->limit(200)->get()
                    ->map(fn (Family $f) => ['id' => $f->id, 'name' => $f->name, 'tag' => $f->tag])->values()
                : [],
        ];

        return $request->wantsJson() ? response()->json($data) : $this->page($family, $member, 'families/relations', 'relations', $data);
    }

    public function propose(Request $request, Family $family, FamilyAudit $audit, FamilyNotifier $notifier): RedirectResponse|JsonResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(FamilyRelation::TYPES))],
            'other_family_id' => ['required', 'integer'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);
        $other = Family::query()->whereKey($data['other_family_id'])->where('server_id', $family->server_id)->whereKeyNot($family->id)->first();
        if ($other === null) {
            throw ValidationException::withMessages(['other_family_id' => 'Сім’ю не знайдено на вашому сервері.']);
        }
        $open = FamilyRelation::query()->whereIn('status', [FamilyRelation::PENDING, FamilyRelation::ACTIVE])
            ->where(fn ($q) => $q->where(fn ($q) => $q->where('family_id', $family->id)->where('other_family_id', $other->id))
                ->orWhere(fn ($q) => $q->where('family_id', $other->id)->where('other_family_id', $family->id)))
            ->exists();
        if ($open) {
            throw ValidationException::withMessages(['other_family_id' => 'З цією сім’єю вже є союз, війна чи пропозиція.']);
        }
        $war = $data['type'] === FamilyRelation::WAR;
        $relation = FamilyRelation::query()->create([
            'family_id' => $family->id,
            'other_family_id' => $other->id,
            'type' => $data['type'],
            'status' => $war ? FamilyRelation::ACTIVE : FamilyRelation::PENDING,
            'note' => $data['note'] ?? null,
            'initiated_by' => $request->user()->id,
            'started_at' => $war ? now() : null,
        ]);
        $label = $war ? 'оголосила війну' : 'пропонує союз';
        $audit->log($family, $war ? 'WAR_DECLARE' : 'ALLIANCE_PROPOSE', $member, null, ['family' => "[{$other->tag}] {$other->name}"]);
        $audit->log($other, $war ? 'WAR_DECLARE' : 'ALLIANCE_PROPOSE', null, null, ['family' => "[{$family->tag}] {$family->name}"]);
        $notifier->holders($other, 'settings.manage', 'relation', "Сім’я [{$family->tag}] {$family->name} {$label}.", route('families.relations', $other, absolute: false));

        return $this->done($request, $war ? 'Війну оголошено.' : 'Пропозицію союзу надіслано.', $relation);
    }

    public function respond(Request $request, Family $family, FamilyRelation $relation, FamilyAudit $audit, FamilyNotifier $notifier): RedirectResponse|JsonResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        abort_unless($relation->other_family_id === $family->id && $relation->status === FamilyRelation::PENDING, 404);
        $accept = $request->boolean('accept');
        $relation->forceFill(['status' => $accept ? FamilyRelation::ACTIVE : FamilyRelation::DECLINED, 'started_at' => $accept ? now() : null])->save();
        $initiator = $relation->family;
        $audit->log($family, $accept ? 'ALLIANCE_ACCEPT' : 'ALLIANCE_DECLINE', $member, null, ['family' => "[{$initiator->tag}] {$initiator->name}"]);
        $audit->log($initiator, $accept ? 'ALLIANCE_ACCEPT' : 'ALLIANCE_DECLINE', null, null, ['family' => "[{$family->tag}] {$family->name}"]);
        $notifier->holders($initiator, 'settings.manage', 'relation', "Сім’я [{$family->tag}] {$family->name} ".($accept ? 'прийняла союз.' : 'відхилила союз.'), route('families.relations', $initiator, absolute: false));

        return $this->done($request, $accept ? 'Союз укладено.' : 'Пропозицію відхилено.', $relation);
    }

    public function end(Request $request, Family $family, FamilyRelation $relation, FamilyAudit $audit, FamilyNotifier $notifier): RedirectResponse|JsonResponse
    {
        $member = $this->member($request, $family, 'settings.manage', write: true);
        abort_unless(in_array($family->id, [$relation->family_id, $relation->other_family_id], true) && $relation->status !== FamilyRelation::ENDED, 404);
        $relation->forceFill(['status' => FamilyRelation::ENDED, 'ended_at' => now()])->save();
        $other = $relation->counterpart($family);
        $action = $relation->type === FamilyRelation::WAR ? 'WAR_END' : 'ALLIANCE_END';
        $audit->log($family, $action, $member, null, ['family' => $other ? "[{$other->tag}] {$other->name}" : null]);
        if ($other) {
            $audit->log($other, $action, null, null, ['family' => "[{$family->tag}] {$family->name}"]);
            $notifier->holders($other, 'settings.manage', 'relation', "Сім’я [{$family->tag}] {$family->name} завершила ".($relation->type === FamilyRelation::WAR ? 'війну.' : 'союз.'), route('families.relations', $other, absolute: false));
        }

        return $this->done($request, $relation->type === FamilyRelation::WAR ? 'Війну завершено.' : 'Союз розірвано.', $relation);
    }

    /** Історія сім’ї: віхи на шкалі часу й досягнення. */
    public function history(Request $request, Family $family): Response|JsonResponse
    {
        $member = $this->member($request, $family);
        $events = collect([['at' => $family->created_at?->toIso8601String(), 'kind' => 'created', 'text' => 'Сім’ю створено']]);
        if ($family->verified_at) {
            $events->push(['at' => $family->verified_at->toIso8601String(), 'kind' => 'verified', 'text' => 'Сім’ю верифіковано']);
        }
        foreach (FamilySeason::query()->where('family_id', $family->id)->orderBy('number')->get() as $season) {
            $first = $season->top[0] ?? null;
            $events->push(['at' => $season->ended_at->toIso8601String(), 'kind' => 'season', 'text' => "Сезон {$season->number} завершено".($first ? " · найкращий — {$first['name']}" : '')]);
        }
        foreach ($this->relations($family)->whereNotNull('started_at') as $r) {
            $other = $r->counterpart($family);
            $name = $other ? "[{$other->tag}] {$other->name}" : '—';
            $events->push(['at' => $r->started_at->toIso8601String(), 'kind' => $r->type, 'text' => ($r->type === FamilyRelation::WAR ? 'Війна з ' : 'Союз із ').$name]);
            if ($r->ended_at) {
                $events->push(['at' => $r->ended_at->toIso8601String(), 'kind' => 'ended', 'text' => ($r->type === FamilyRelation::WAR ? 'Кінець війни з ' : 'Кінець союзу з ').$name]);
            }
        }
        $events = $events->filter(fn ($e) => $e['at'] !== null)->sortByDesc('at')->values();

        $approved = FamilyReport::query()->where('family_id', $family->id)->where('status', FamilyReport::STATUS_APPROVED);
        $wins = (int) (clone $approved)->where('type', FamilyReport::TYPE_BIZWAR)->get(['data'])->sum(fn ($r) => (int) ($r->data['wins'] ?? 0));
        $contracts = (int) (clone $approved)->where('type', FamilyReport::TYPE_CONTRACT)->get(['data'])->sum(fn ($r) => (int) ($r->data['count'] ?? 0));
        $reports = (clone $approved)->count();
        $members = (int) $family->members_count;
        $days = $family->created_at ? (int) $family->created_at->diffInDays(now()) : 0;
        $seasons = FamilySeason::query()->where('family_id', $family->id)->count();
        $achievements = [
            ['key' => 'members25', 'title' => '25 учасників', 'progress' => $members, 'target' => 25],
            ['key' => 'members50', 'title' => '50 учасників', 'progress' => $members, 'target' => 50],
            ['key' => 'reports100', 'title' => '100 схвалених звітів', 'progress' => $reports, 'target' => 100],
            ['key' => 'reports1000', 'title' => '1000 схвалених звітів', 'progress' => $reports, 'target' => 1000],
            ['key' => 'wins50', 'title' => '50 перемог у бізварах', 'progress' => $wins, 'target' => 50],
            ['key' => 'contracts500', 'title' => '500 контрактів', 'progress' => $contracts, 'target' => 500],
            ['key' => 'seasons3', 'title' => '3 завершені сезони', 'progress' => $seasons, 'target' => 3],
            ['key' => 'year', 'title' => 'Рік на сервері', 'progress' => $days, 'target' => 365],
        ];
        $data = [
            'events' => $events,
            'achievements' => array_map(fn ($a) => [...$a, 'done' => $a['progress'] >= $a['target']], $achievements),
            'totals' => ['reports' => $reports, 'wins' => $wins, 'contracts' => $contracts, 'days' => $days],
        ];

        return $request->wantsJson() ? response()->json($data) : $this->page($family, $member, 'families/history', 'history', $data);
    }

    /** @return Collection<int, FamilyRelation> */
    private function relations(Family $family)
    {
        return FamilyRelation::query()->with(['family', 'other'])
            ->where(fn ($q) => $q->where('family_id', $family->id)->orWhere('other_family_id', $family->id))
            ->whereIn('status', [FamilyRelation::PENDING, FamilyRelation::ACTIVE, FamilyRelation::ENDED])
            ->latest('id')->limit(100)->get();
    }

    /** @return array<string, mixed> */
    private function card(Family $family, FamilyRelation $r): array
    {
        $other = $r->counterpart($family);

        return [
            'id' => $r->id,
            'type' => $r->type,
            'status' => $r->status,
            'note' => $r->note,
            'incoming' => $r->status === FamilyRelation::PENDING && $r->other_family_id === $family->id,
            'family' => $other ? ['id' => $other->id, 'slug' => $other->slug, 'name' => $other->name, 'tag' => $other->tag, 'logo_url' => $other->toCard()['logo_url'] ?? null] : null,
            'started_at' => $r->started_at?->toIso8601String(),
            'ended_at' => $r->ended_at?->toIso8601String(),
            'created_at' => $r->created_at?->toIso8601String(),
        ];
    }

    private function done(Request $request, string $message, FamilyRelation $relation): RedirectResponse|JsonResponse
    {
        if ($request->wantsJson()) {
            return response()->json(['ok' => true, 'id' => $relation->id, 'message' => $message]);
        }
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return back();
    }
}
