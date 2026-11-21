<?php

namespace App\Http\Controllers\Developer;

use App\Http\Controllers\Controller;
use App\Models\Clan;
use App\Models\ClanMember;
use App\Models\Conversation;
use App\Models\DeveloperToken;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\User;
use App\Services\Clans\ClanService;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Services\Music\MusicConnect;
use App\Services\MusicService;
use App\Services\Voice\LiveKit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * GameCon SDK для ігор і застосунків (developer/v1, OAuth-токен людини):
 *  voice  — голосові кімнати лобі й матчів (LiveKit), окремі для кожного застосунку;
 *  chat   — бесіди, історія, надсилання (як у «Повідомленнях», з тими самими обмеженнями);
 *  groups — сім’ї, клани й гільдії людини, склад; groups:manage — ранги й виключення в кланах;
 *  music  — що грає й керування відтворенням на пристроях GameCon Connect.
 */
class SdkApiController extends Controller
{
    private function token(Request $request): DeveloperToken
    {
        /** @var DeveloperToken $token */
        $token = $request->attributes->get('oauth_token');

        return $token;
    }

    // ───────────── Голос ─────────────

    /** Увійти в голосову кімнату: ключ — будь-який ідентифікатор лобі чи матчу у вашій грі. */
    public function voiceJoin(Request $request, LiveKit $livekit, string $key): JsonResponse
    {
        abort_unless($livekit->configured(), 503, 'Голосовий сервер GameCon тимчасово недоступний.');
        abort_unless(preg_match('/^[A-Za-z0-9_\-:.]{1,64}$/', $key) === 1, 422, 'Ключ кімнати: до 64 символів A-Z, 0-9, _-:.');
        $data = $request->validate(['listen_only' => ['nullable', 'boolean']]);
        $user = $request->user();
        $app = $this->token($request)->developer_app_id;
        // Кімнати застосунків ізольовані: та сама назва в різних іграх — різні кімнати.
        $room = 'app'.$app.'-'.substr(hash('sha256', $app.'|'.$key), 0, 24);
        $listenOnly = (bool) ($data['listen_only'] ?? false);

        return response()->json(['data' => [
            'url' => $livekit->url(),
            'room' => $room,
            'token' => $livekit->token('u'.$user->id, $user->name ?: $user->username, $room, $listenOnly ? ['canPublish' => false] : [], json_encode(['username' => $user->username, 'avatar' => $user->avatar_url, 'app' => $app]) ?: null),
            'identity' => 'u'.$user->id,
            'expires_in' => 2 * 3600,
        ]]);
    }

    // ───────────── Чат ─────────────

    public function conversations(Request $request, Messenger $messenger, MessengerPresenter $presenter): JsonResponse
    {
        $keys = array_flip(['id', 'type', 'title', 'avatar_url', 'peer', 'members_count', 'unread', 'is_muted', 'last_message']);

        return response()->json(['data' => array_map(fn (array $c) => array_intersect_key($c, $keys), $presenter->inbox($request->user(), $messenger))]);
    }

    public function messages(Request $request, Conversation $conversation, MessengerPresenter $presenter): JsonResponse
    {
        $this->member($conversation, $request->user());
        $data = $request->validate(['before' => ['nullable', 'integer', 'min:1']]);
        $history = $presenter->history($conversation, isset($data['before']) ? (int) $data['before'] : null, $request->user());

        return response()->json(['data' => $history['messages'], 'has_more' => $history['has_more']]);
    }

    public function send(Request $request, Conversation $conversation, Messenger $messenger, MessengerPresenter $presenter): JsonResponse
    {
        $this->member($conversation, $request->user());
        $data = $request->validate(['body' => ['required', 'string', 'max:4000'], 'reply_to' => ['nullable', 'integer']]);
        $message = $messenger->send($conversation, $request->user(), $data['body'], [], isset($data['reply_to']) ? (int) $data['reply_to'] : null);

        return response()->json(['data' => $presenter->message($presenter->load($message))], 201);
    }

    /** Особиста бесіда з гравцем за ніком (з урахуванням його налаштувань приватності). */
    public function direct(Request $request, Messenger $messenger, string $username): JsonResponse
    {
        $peer = User::query()->where('username', $username)->whereNull('banned_at')->firstOrFail();
        abort_unless($messenger->canMessage($request->user(), $peer), 403, 'Цьому гравцю не можна написати.');

        return response()->json(['data' => ['id' => $messenger->direct($request->user(), $peer)->id]]);
    }

    private function member(Conversation $conversation, User $user): void
    {
        $me = $conversation->participantFor($user);
        abort_if($me === null || $me->left_at !== null, 404);
    }

    // ───────────── Сім’ї, клани, гільдії ─────────────

    public function groups(Request $request): JsonResponse
    {
        $user = $request->user();
        $families = FamilyMember::query()->with('family')->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->get()
            ->filter(fn (FamilyMember $m) => $m->family !== null)
            ->map(fn (FamilyMember $m) => [
                'kind' => 'family', 'id' => $m->family->id, 'slug' => $m->family->slug, 'name' => $m->family->name, 'tag' => $m->family->tag,
                'logo_url' => $m->family->logo_url, 'rank' => $m->rank, 'nickname' => $m->rp_nickname,
                'conversation_id' => $m->family->conversation_id, 'url' => url('/families/'.$m->family->slug),
            ]);
        $clans = ClanMember::query()->with('clan')->where('user_id', $user->id)->where('status', ClanMember::STATUS_ACTIVE)->get()
            ->filter(fn (ClanMember $m) => $m->clan !== null)
            ->map(fn (ClanMember $m) => [
                'kind' => $m->clan->type === 'guild' ? 'guild' : 'clan', 'id' => $m->clan->id, 'slug' => $m->clan->slug, 'name' => $m->clan->name, 'tag' => $m->clan->tag,
                'logo_url' => $m->clan->logo_url, 'rank' => $m->rank, 'rank_title' => $m->clan->rankTitle($m->rank), 'members_count' => $m->clan->members_count,
                'conversation_id' => $m->clan->conversation_id, 'url' => url('/clans/'.$m->clan->slug),
            ]);

        return response()->json(['data' => [...$families->values()->all(), ...$clans->values()->all()]]);
    }

    /** Склад сім'ї (RP-штаб) для віджета оверлею: учасники з онлайном, казна й свій баланс. */
    public function familyMembers(Request $request, Family $family): JsonResponse
    {
        $me = FamilyMember::query()->where('family_id', $family->id)->where('user_id', $request->user()->id)->where('status', FamilyMember::STATUS_ACTIVE)->first();
        abort_if($me === null, 404);
        $members = FamilyMember::query()->with('user')->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)
            ->orderByDesc('rank')->limit(300)->get()
            ->map(fn (FamilyMember $m) => [
                'id' => $m->id, 'nickname' => $m->rp_nickname, 'rank' => $m->rank, 'rank_title' => $family->rankTitle($m->rank),
                'user' => $m->user ? ['id' => $m->user->id, 'username' => $m->user->username, 'name' => $m->user->name, 'avatar_url' => $m->user->avatar_url, 'online' => $m->user->is_online] : null,
            ])->sortByDesc(fn ($m) => $m['user']['online'] ?? false)->values();

        return response()->json(['data' => $members, 'family' => [
            'id' => $family->id, 'name' => $family->name, 'tag' => $family->tag, 'logo_url' => $family->logo_url,
            'treasury' => $family->treasury, 'my_balance' => $me->balance, 'members_count' => $family->members_count,
            'online' => $members->filter(fn ($m) => $m['user']['online'] ?? false)->count(),
        ]]);
    }

    public function clanMembers(Request $request, Clan $clan, ClanService $clans): JsonResponse
    {
        abort_if($clans->member($clan, $request->user())?->status !== ClanMember::STATUS_ACTIVE, 404);
        $members = ClanMember::query()->with('user')->where('clan_id', $clan->id)->where('status', ClanMember::STATUS_ACTIVE)
            ->orderByDesc('rank')->limit(500)->get()
            ->map(fn (ClanMember $m) => [
                'id' => $m->id, 'user' => $m->user ? ['id' => $m->user->id, 'username' => $m->user->username, 'name' => $m->user->name, 'avatar_url' => $m->user->avatar_url] : null,
                'rank' => $m->rank, 'rank_title' => $clan->rankTitle($m->rank), 'nickname' => $m->nickname, 'joined_at' => $m->joined_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $members->values()]);
    }

    /** groups:manage — ранг чи виключення (за правами людини в клані «Керувати складом»). */
    public function clanManage(Request $request, Clan $clan, ClanMember $member, ClanService $clans): JsonResponse
    {
        abort_unless($member->clan_id === $clan->id, 404);
        $data = $request->validate(['action' => ['required', Rule::in(['rank', 'kick', 'accept', 'decline'])], 'rank' => ['required_if:action,rank', 'integer', 'min:0', 'max:10']]);
        $actor = $clans->member($clan, $request->user());
        match ($data['action']) {
            'rank' => $clans->setRank($clan, $actor, $member, (int) $data['rank']),
            'kick' => $clans->kick($clan, $actor, $member),
            'accept' => $clans->accept($clan, $actor, $member),
            'decline' => $clans->decline($clan, $actor, $member),
        };
        Log::info('developers.sdk.clan_manage', ['app' => $this->token($request)->developer_app_id, 'user' => $request->user()->id, 'clan' => $clan->id, 'member' => $member->id, 'action' => $data['action']]);

        return response()->json(['ok' => true]);
    }

    // ───────────── Музика ─────────────

    public function nowPlaying(Request $request, MusicService $music, MusicConnect $connect): JsonResponse
    {
        $user = $request->user();

        return response()->json(['data' => ['now' => $music->currentFor($user, $user), ...$connect->devices($user)]]);
    }

    public function musicCommand(Request $request, MusicConnect $connect): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['play', 'pause', 'toggle', 'next', 'prev', 'seek', 'volume'])],
            'value' => ['nullable', 'numeric', 'min:0', 'max:86400'],
            'device_id' => ['nullable', 'string', 'max:64'],
        ]);
        $user = $request->user();
        $target = $data['device_id'] ?? ($connect->devices($user)['active_device_id'] ?? null);
        abort_if($target === null, 409, 'Немає активного пристрою GameCon з музикою.');
        $ok = $connect->command($user, (string) $target, $data['action'], isset($data['value']) ? (float) $data['value'] : null, 'app:'.$this->token($request)->developer_app_id);

        return response()->json(['ok' => $ok], $ok ? 200 : 409);
    }
}
