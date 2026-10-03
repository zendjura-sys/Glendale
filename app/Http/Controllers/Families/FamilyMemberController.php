<?php

namespace App\Http\Controllers\Families;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\FamilyPunishment;
use App\Services\Families\FamilyAudit;
use App\Services\Families\FamilyService;
use App\Services\Voice\VoiceRooms;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FamilyMemberController extends FamilyBaseController
{
    public function index(Request $request, Family $family, VoiceRooms $voice): Response
    {
        $member = $this->member($request, $family);
        $can = $this->gate->abilities($member, $family);
        $tab = $request->string('tab')->toString() === 'applications' && $can['members.manage'] ? 'applications' : 'members';

        $warns = FamilyPunishment::query()->active()->where('family_id', $family->id)->where('type', FamilyPunishment::TYPE_WARN)
            ->selectRaw('member_id, count(*) as total')->groupBy('member_id')->pluck('total', 'member_id');

        $members = FamilyMember::query()->with('user')
            ->where('family_id', $family->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)
            ->orderByDesc('rank')->orderBy('joined_at')
            ->get()
            ->map(fn (FamilyMember $m) => [
                ...$m->toCard($family),
                'joined_at' => $m->joined_at?->toIso8601String(),
                'is_owner' => $m->user_id === $family->owner_id,
                'balance' => $can['treasury.manage'] || $m->id === $member->id ? $m->balance : null,
                'warns' => (int) ($warns[$m->id] ?? 0),
                'manageable' => $can['members.manage'] && $member->outranks($m, $family),
                'last_seen_at' => $m->user->last_seen_at?->toIso8601String(),
            ]);

        $access = $can['ranks.manage'] ? $voice->familyAccess($family) : ['labels' => [], 'matrix' => []];

        return $this->page($family, $member, 'families/members', 'members', [
            'tab' => $tab,
            'members' => $members,
            'applications' => $can['members.manage']
                ? FamilyMember::query()->with('user')->where('family_id', $family->id)->where('status', FamilyMember::STATUS_PENDING)->oldest('updated_at')->get()
                    ->map(fn (FamilyMember $m) => [...$m->toCard($family), 'note' => $m->application_note, 'applied_at' => $m->updated_at->toIso8601String()])
                : [],
            'permissions' => Family::PERMISSIONS,
            'voice_rooms' => $access['labels'],
            'matrix' => [...$family->permissionMatrix(), ...$access['matrix']],
            'warn_limit' => (int) $family->setting('discipline.warn_limit', 3),
        ]);
    }

    public function accept(Request $request, Family $family, FamilyMember $member, FamilyService $families): RedirectResponse
    {
        $actor = $this->member($request, $family, 'members.manage', write: true);
        $families->accept($family, $actor, $member);
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$member->displayName()} тепер у сім’ї!"]);

        return back();
    }

    public function decline(Request $request, Family $family, FamilyMember $member, FamilyService $families): RedirectResponse
    {
        $actor = $this->member($request, $family, 'members.manage', write: true);
        $families->decline($family, $actor, $member, $request->validate(['reason' => ['nullable', 'string', 'max:300']])['reason'] ?? null);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Заявку відхилено.']);

        return back();
    }

    public function update(Request $request, Family $family, FamilyMember $member, FamilyService $families): RedirectResponse
    {
        $actor = $this->member($request, $family, write: true);
        $self = $actor->id === $member->id;

        $data = $request->validate([
            'rank' => ['sometimes', 'integer', 'min:1', 'max:9'],
            'duties' => ['sometimes', 'nullable', 'string', 'max:160'],
            'rp_nickname' => ['sometimes', ...array_slice(self::nicknameRules()['rp_nickname'], 1)],
            'static_id' => ['sometimes', ...array_slice(self::nicknameRules()['static_id'], 1)],
        ], self::nicknameMessages());

        if (array_key_exists('rank', $data)) {
            $this->gate->authorize($actor, $family, 'members.manage');
            $families->setRank($family, $actor, $member, (int) $data['rank']);
        }
        if (array_key_exists('duties', $data)) {
            $this->gate->authorize($actor, $family, $self ? 'ranks.manage' : 'members.manage');
            $families->setDuties($family, $actor, $member->refresh(), $data['duties'] ?: null);
        }
        if (isset($data['rp_nickname'], $data['static_id'])) {
            abort_unless(
                $this->gate->can($actor, $family, 'members.manage') && ($self || $actor->outranks($member, $family)),
                403,
                'RP-дані змінює офіцер із правом керування складом.',
            );
            $families->updateIdentity($family, $actor, $member, $data['rp_nickname'], $data['static_id']);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Збережено.']);

        return back();
    }

    public function kick(Request $request, Family $family, FamilyMember $member, FamilyService $families): RedirectResponse
    {
        $actor = $this->member($request, $family, 'members.manage', write: true);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']]);
        $families->kick($family, $actor, $member, $data['reason']);
        Inertia::flash('toast', ['type' => 'success', 'message' => "{$member->displayName()} виключено."]);

        return back();
    }

    public function transfer(Request $request, Family $family, FamilyMember $member, FamilyService $families): RedirectResponse
    {
        $actor = $this->member($request, $family, write: true);
        $families->transfer($family, $actor, $member);
        Inertia::flash('toast', ['type' => 'success', 'message' => "Лідерство передано {$member->displayName()}."]);

        return back();
    }

    public function ranks(Request $request, Family $family, FamilyAudit $audit, VoiceRooms $voice): RedirectResponse
    {
        $actor = $this->member($request, $family, 'ranks.manage', write: true);
        $data = $request->validate([
            'titles' => ['required', 'array', 'size:10'],
            'titles.*' => ['required', 'string', 'max:24'],
            'matrix' => ['required', 'array'],
            'matrix.*' => ['array'],
            'matrix.*.*' => ['integer', 'between:1,9'],
        ]);

        $titles = [];
        foreach (range(1, 10) as $rank) {
            $titles[$rank] = trim((string) (array_values($data['titles'])[$rank - 1] ?? Family::DEFAULT_RANKS[$rank]));
        }

        $matrix = [];
        foreach (array_keys(Family::PERMISSIONS) as $permission) {
            $ranks = array_values(array_unique(array_map('intval', $data['matrix'][$permission] ?? [])));
            sort($ranks);
            // Неможливо видати право рангу вище за власний — інакше заступник підняв би себе.
            if ($actor->user_id !== $family->owner_id) {
                $ranks = array_values(array_filter($ranks, fn (int $r) => $r < $actor->rank || in_array($r, $family->permissionMatrix()[$permission], true)));
            }
            $matrix[$permission] = $ranks;
        }

        // Доступ до голосових кімнат (voice.room.{id}) — у тій самій матриці, з тим самим обмеженням.
        $current = $voice->familyAccess($family)['matrix'];
        $rooms = [];
        foreach ($current as $key => $allowed) {
            if (! array_key_exists($key, $data['matrix'])) {
                continue;
            }
            $ranks = array_values(array_unique(array_map('intval', (array) $data['matrix'][$key])));
            if ($actor->user_id !== $family->owner_id) {
                $ranks = array_values(array_filter($ranks, fn (int $r) => $r < $actor->rank || in_array($r, $allowed, true)));
            }
            $rooms[$key] = $ranks;
        }
        [$roomsBefore, $roomsAfter] = $voice->saveFamilyAccess($family, $rooms);
        if ($roomsAfter !== []) {
            $audit->log($family, 'VOICE_ACCESS_UPDATE', $actor, null, ['from' => $roomsBefore, 'to' => $roomsAfter]);
        }

        $before = ['titles' => $family->rankTitles(), 'matrix' => $family->permissionMatrix()];
        $family->update(['rank_titles' => $titles, 'permissions' => $matrix]);

        if ($before['titles'] !== $titles) {
            $audit->log($family, 'RANK_TITLES_UPDATE', $actor, null, ['from' => $before['titles'], 'to' => $titles]);
        }
        if ($before['matrix'] !== $matrix) {
            $audit->log($family, 'PERMISSIONS_UPDATE', $actor, null, ['from' => $before['matrix'], 'to' => $matrix]);
        }
        $this->gate->forget();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Ранги й права збережено.']);

        return back();
    }
}
