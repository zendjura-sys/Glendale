<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Families\FamilyBaseController;
use App\Models\Clan;
use App\Models\Community;
use App\Models\Family;
use App\Models\InviteLink;
use App\Models\PartyPost;
use App\Models\VoiceRoom;
use App\Services\InviteLinks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InviteLinkController extends Controller
{
    public function __construct(private readonly InviteLinks $links) {}

    public function clan(Request $request, Clan $clan): JsonResponse
    {
        return $this->issued($this->links->issue($request->user(), InviteLink::CLAN, $clan->id));
    }

    public function family(Request $request, Family $family): JsonResponse
    {
        return $this->issued($this->links->issue($request->user(), InviteLink::FAMILY, $family->id));
    }

    public function community(Request $request, Community $community): JsonResponse
    {
        return $this->issued($this->links->issue($request->user(), InviteLink::COMMUNITY, $community->id));
    }

    public function party(Request $request, PartyPost $party): JsonResponse
    {
        return $this->issued($this->links->issue($request->user(), InviteLink::PARTY, $party->id));
    }

    public function voice(Request $request, VoiceRoom $room): JsonResponse
    {
        return $this->issued($this->links->issue($request->user(), InviteLink::VOICE, $room->id));
    }

    public function show(string $token): Response
    {
        $link = $this->find($token);

        return Inertia::render('join/show', [
            'token' => $link->token,
            'invite' => $this->links->preview($link),
        ]);
    }

    public function accept(Request $request, string $token): RedirectResponse
    {
        $link = $this->find($token);
        $data = $link->kind === InviteLink::FAMILY
            ? $request->validate(FamilyBaseController::nicknameRules(), FamilyBaseController::nicknameMessages())
            : [];
        $href = $this->links->accept($request->user(), $link, $data);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запрошення прийнято.']);

        return redirect($href);
    }

    private function find(string $token): InviteLink
    {
        $link = InviteLink::query()->where('token', $token)->first();
        abort_unless($link instanceof InviteLink, 404);

        return $link;
    }

    private function issued(InviteLink $link): JsonResponse
    {
        return response()->json(['url' => url('/join/'.$link->token)]);
    }
}
