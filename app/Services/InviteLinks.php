<?php

namespace App\Services;

use App\Models\Clan;
use App\Models\Community;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\InviteLink;
use App\Models\PartyPost;
use App\Models\User;
use App\Models\VoiceRoom;
use App\Services\Clans\ClanService;
use App\Services\Families\FamilyGate;
use App\Services\Families\FamilyService;
use App\Services\Party\PartyBoard;
use App\Services\Voice\VoiceRooms;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Коротке посилання від керівника: клан і закрита спільнота приймають одразу, сім’я — після нікнейма.
 */
class InviteLinks
{
    public function __construct(
        private readonly ClanService $clans,
        private readonly CommunityService $communities,
        private readonly FamilyService $families,
        private readonly FamilyGate $gate,
        private readonly PartyBoard $parties,
        private readonly VoiceRooms $voice,
    ) {}

    public function issue(User $user, string $kind, int $id): InviteLink
    {
        $this->authorize($user, $kind, $id);

        return InviteLink::query()->create([
            'token' => Str::lower(Str::random(12)),
            'kind' => $kind,
            'subject_id' => $id,
            'user_id' => $user->id,
            'expires_at' => now()->addDays(14),
        ]);
    }

    /**
     * @return array{kind: string, name: string, href: string, needs_identity: bool}
     */
    public function preview(InviteLink $link): array
    {
        $this->usable($link);

        return match ($link->kind) {
            InviteLink::CLAN => $this->clanPreview($link),
            InviteLink::FAMILY => $this->familyPreview($link),
            InviteLink::PARTY => $this->partyPreview($link),
            InviteLink::VOICE => $this->voicePreview($link),
            default => $this->communityPreview($link),
        };
    }

    /**
     * @param  array{rp_nickname?: string, static_id?: string}  $data
     */
    public function accept(User $user, InviteLink $link, array $data = []): string
    {
        $this->usable($link);

        return match ($link->kind) {
            InviteLink::CLAN => $this->acceptClan($user, $link),
            InviteLink::FAMILY => $this->acceptFamily($user, $link, $data),
            InviteLink::PARTY => $this->acceptParty($user, $link),
            InviteLink::VOICE => $this->acceptVoice($user, $link),
            default => $this->acceptCommunity($user, $link),
        };
    }

    private function authorize(User $user, string $kind, int $id): void
    {
        match ($kind) {
            InviteLink::CLAN => $this->authorizeClan($user, $id),
            InviteLink::FAMILY => $this->authorizeFamily($user, $id),
            InviteLink::COMMUNITY => $this->authorizeCommunity($user, $id),
            InviteLink::PARTY => $this->authorizeParty($user, $id),
            InviteLink::VOICE => $this->authorizeVoice($user, $id),
            default => abort(404),
        };
    }

    private function authorizeClan(User $user, int $id): void
    {
        $clan = Clan::query()->findOrFail($id);
        $member = $this->clans->member($clan, $user);
        abort_unless($member && $this->clans->can($member, $clan, 'members.manage'), 403);
    }

    private function authorizeFamily(User $user, int $id): void
    {
        $family = Family::query()->findOrFail($id);
        $member = $this->gate->member($family, $user);
        abort_unless($member && $this->gate->can($member, $family, 'members.manage'), 403);
    }

    private function authorizeCommunity(User $user, int $id): void
    {
        $community = Community::query()->findOrFail($id);
        abort_unless($community->membershipFor($user)?->isManager() === true, 403);
    }

    /** Покликати в паті може автор або учасник, поки оголошення відкрите. */
    private function authorizeParty(User $user, int $id): void
    {
        $party = PartyPost::query()->findOrFail($id);
        abort_unless($party->isOpen() && $party->hasMember($user), 403);
    }

    /** Посилання на голосову кімнату — для тих, хто сам може в неї зайти. */
    private function authorizeVoice(User $user, int $id): void
    {
        $room = VoiceRoom::query()->findOrFail($id);
        abort_unless($this->voice->canEnter($user, $room), 403);
    }

    private function usable(InviteLink $link): void
    {
        $link->loadMissing('user');
        abort_unless($link->freshEnough() && $link->user !== null, 410, 'Посилання більше не діє.');
    }

    /**
     * @return array{kind: string, name: string, href: string, needs_identity: bool}
     */
    private function clanPreview(InviteLink $link): array
    {
        $clan = Clan::query()->findOrFail($link->subject_id);

        return ['kind' => InviteLink::CLAN, 'name' => $clan->display_name, 'href' => '/clans/'.$clan->slug, 'needs_identity' => false];
    }

    /**
     * @return array{kind: string, name: string, href: string, needs_identity: bool}
     */
    private function familyPreview(InviteLink $link): array
    {
        $family = Family::query()->findOrFail($link->subject_id);

        return ['kind' => InviteLink::FAMILY, 'name' => '['.$family->tag.'] '.$family->name, 'href' => '/f/'.$family->slug, 'needs_identity' => true];
    }

    /**
     * @return array{kind: string, name: string, href: string, needs_identity: bool}
     */
    private function communityPreview(InviteLink $link): array
    {
        $community = Community::query()->findOrFail($link->subject_id);

        return ['kind' => InviteLink::COMMUNITY, 'name' => $community->name, 'href' => '/c/'.$community->slug, 'needs_identity' => false];
    }

    /**
     * @return array{kind: string, name: string, href: string, needs_identity: bool}
     */
    private function partyPreview(InviteLink $link): array
    {
        $party = PartyPost::query()->findOrFail($link->subject_id);

        return ['kind' => InviteLink::PARTY, 'name' => $party->title, 'href' => '/party/'.$party->id, 'needs_identity' => false];
    }

    /**
     * @return array{kind: string, name: string, href: string, needs_identity: bool}
     */
    private function voicePreview(InviteLink $link): array
    {
        $room = VoiceRoom::query()->findOrFail($link->subject_id);

        return ['kind' => InviteLink::VOICE, 'name' => $room->name, 'href' => $this->voiceHref($room), 'needs_identity' => false];
    }

    private function acceptParty(User $user, InviteLink $link): string
    {
        $party = PartyPost::query()->findOrFail($link->subject_id);
        $this->authorizeParty($link->user, $party->id);
        if (! $party->hasMember($user)) {
            $this->parties->join($party, $user, null);
        }

        return '/party/'.$party->id;
    }

    /**
     * Голосова кімната: учасник групи заходить одразу (?voice= на сторінці групи); у відкриту спільноту —
     * спершу вступ; у закриту групу, сім’ю чи клан посилання на кімнату не пускає.
     */
    private function acceptVoice(User $user, InviteLink $link): string
    {
        $room = VoiceRoom::query()->findOrFail($link->subject_id);
        abort_unless($this->voice->canEnter($link->user, $room), 410, 'Посилання більше не діє.');
        $owner = $this->voice->ownerOf($room);
        if (! $this->voice->canEnter($user, $room)) {
            if ($owner instanceof Community && ! $owner->isClosed()) {
                $this->communities->join($owner, $user);
            } elseif ($owner instanceof PartyPost) {
                $this->parties->join($owner, $user, null);
            }
            abort_unless($this->voice->canEnter($user, $room), 403, 'Ця голосова кімната — лише для учасників групи.');
        }

        return $this->voiceHref($room).'?voice='.$room->id;
    }

    private function voiceHref(VoiceRoom $room): string
    {
        $owner = $this->voice->ownerOf($room);

        return match (true) {
            $owner instanceof Family => '/f/'.$owner->slug,
            $owner instanceof Community => '/c/'.$owner->slug,
            $owner instanceof Clan => '/clans/'.$owner->slug,
            $owner instanceof PartyPost => '/party/'.$owner->id,
            default => '/servers/'.$owner->slug,
        };
    }

    private function acceptClan(User $user, InviteLink $link): string
    {
        $clan = Clan::query()->findOrFail($link->subject_id);
        $this->authorizeClan($link->user, $clan->id);
        $this->clans->join($clan, $user, 'За запрошенням', null, null, true);

        return '/clans/'.$clan->slug;
    }

    /**
     * @param  array{rp_nickname?: string, static_id?: string}  $data
     */
    private function acceptFamily(User $user, InviteLink $link, array $data): string
    {
        $family = Family::query()->findOrFail($link->subject_id);
        $inviter = $this->gate->member($family, $link->user);
        abort_unless($inviter && $this->gate->can($inviter, $family, 'members.manage'), 410, 'Посилання більше не діє.');
        $nickname = trim((string) ($data['rp_nickname'] ?? ''));
        $static = trim((string) ($data['static_id'] ?? ''));
        if ($nickname === '' || $static === '') {
            throw ValidationException::withMessages(['rp_nickname' => 'Вкажіть нікнейм і static ID.']);
        }
        $member = $this->families->apply($family, $user, [
            'rp_nickname' => $nickname,
            'static_id' => $static,
            'note' => 'За запрошенням',
        ], true);
        if ($member->status === FamilyMember::STATUS_PENDING) {
            $this->families->accept($family, $inviter, $member);
        }

        return '/f/'.$family->slug;
    }

    private function acceptCommunity(User $user, InviteLink $link): string
    {
        $community = Community::query()->findOrFail($link->subject_id);
        abort_unless($community->membershipFor($link->user)?->isManager() === true, 410, 'Посилання більше не діє.');
        $this->communities->join($community, $user, true);

        return '/c/'.$community->slug;
    }
}
