<?php

namespace App\Http\Controllers;

use App\Models\FamilyMember;
use App\Models\User;
use App\Models\VoiceRoom;
use App\Services\Engagement\Streaks;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Services\Quests\SeasonPass;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use App\Support\Profile\ProfileTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Бічна колонка: заявки в друзі (прийняти/відхилити), контакти з непрочитаними, друзі онлайн
 * й останні бесіди — праворуч у стрічці й у четвертій колонці на великих екранах.
 */
class RailController extends Controller
{
    public function __invoke(Request $request, FriendshipService $friendships, MessengerPresenter $presenter, Messenger $messenger, ModuleManager $modules): JsonResponse
    {
        $user = $request->user();
        $friendIds = $friendships->friendIds($user);

        $chats = $modules->enabled('messages') ? $presenter->inbox($user, $messenger) : [];
        $unread = [];
        foreach ($chats as $chat) {
            if (is_array($chat['peer'] ?? null) && isset($chat['peer']['id'])) {
                $unread[(int) $chat['peer']['id']] = ['chat' => (int) $chat['id'], 'unread' => (int) $chat['unread']];
            }
        }

        return response()->json([
            // Ліва колонка (Gamer Dock): картка гравця, голосові кімнати сімей, друзі в грі.
            'me' => $this->me($user, $modules),
            'voice' => $this->voice($user, $modules),
            'in_game' => User::query()->whereIn('id', $friendIds === [] ? [0] : $friendIds)
                ->where('last_seen_at', '>=', now()->subMinutes(10))->where('playing_until', '>', now())
                ->orderByDesc('last_seen_at')->limit(6)->get()
                ->map(fn (User $u) => [...$u->toCard(), 'playing' => $u->playing()])->values(),
            'requests' => $friendships->incomingQuery($user)->latest('id')->limit(3)->get()
                ->map(fn (User $u) => $u->toCard())->values(),
            'requests_total' => $friendships->incomingCount($user),
            'contacts' => User::query()->whereIn('id', $friendIds === [] ? [0] : $friendIds)
                ->orderByDesc('last_seen_at')->limit(10)->get()
                ->map(fn (User $u) => [
                    ...$u->toCard(),
                    'chat_id' => $unread[$u->id]['chat'] ?? null,
                    'unread' => $unread[$u->id]['unread'] ?? 0,
                ])->values(),
            'contacts_total' => count($friendIds),
            'online' => User::query()->whereIn('id', $friendIds === [] ? [0] : $friendIds)
                ->where('last_seen_at', '>=', now()->subMinutes(5))
                ->orderByDesc('last_seen_at')->limit(16)->get()
                ->map(fn (User $u) => $u->toCard())->values(),
            'chats' => $modules->enabled('messages')
                ? array_map(fn (array $c) => [
                    'id' => $c['id'],
                    'title' => $c['title'],
                    'avatar_url' => $c['avatar_url'],
                    'peer' => $c['peer'],
                    'unread' => $c['unread'],
                ], array_slice($chats, 0, 8))
                : [],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function me(User $user, ModuleManager $modules): array
    {
        $membership = $modules->enabled('families')
            ? FamilyMember::query()->with('family')->where('user_id', $user->id)->where('status', FamilyMember::STATUS_ACTIVE)->first()
            : null;
        $level = null;
        if ($modules->enabled('quests')) {
            try {
                $level = app(SeasonPass::class)->board($user)['level'] ?? null;
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return [
            'level' => $level,
            'streak' => app(Streaks::class)->state($user)['days'] ?? null,
            'family' => $membership?->family ? ['name' => $membership->family->name, 'href' => '/f/'.$membership->family->slug] : null,
            'track' => app(Plugins::class)->on('profile_track') ? ProfileTrack::of($user) : null,
            'playing' => $user->playing(),
        ];
    }

    /**
     * Голосові кімнати сімей людини, де зараз хтось є (лише читання — нічого не створюємо).
     *
     * @return list<array<string, mixed>>
     */
    private function voice(User $user, ModuleManager $modules): array
    {
        if (! $modules->enabled('families')) {
            return [];
        }
        $families = FamilyMember::query()->with('family')->where('user_id', $user->id)
            ->where('status', FamilyMember::STATUS_ACTIVE)->get()->pluck('family')->filter()->keyBy('id');
        if ($families->isEmpty()) {
            return [];
        }

        return array_values(VoiceRoom::query()->where('owner_type', VoiceRoom::OWNER_FAMILY)->whereIn('owner_id', $families->keys())
            ->whereHas('participants')->with(['participants.user'])->limit(4)->get()
            ->map(fn (VoiceRoom $room) => [
                'id' => $room->id,
                'name' => $room->name,
                'owner' => $families[$room->owner_id]->name ?? '',
                'href' => '/f/'.($families[$room->owner_id]->slug ?? ''),
                'count' => $room->participants->count(),
                'people' => $room->participants->pluck('user')->filter()->take(4)->map(fn (User $u) => $u->toCard())->values()->all(),
            ])->all());
    }
}
