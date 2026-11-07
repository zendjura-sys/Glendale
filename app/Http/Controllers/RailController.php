<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Services\MessengerPresenter;
use App\Support\Modules\ModuleManager;
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
}
