<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Services\FriendshipService;
use App\Services\Messenger;
use App\Services\Quests\DailyQuests;
use App\Services\Quests\SeasonPass;
use App\Support\Modules\ModuleManager;
use App\Support\NotifyPrefs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Віджет «Пульс GameCon» на головному екрані Android: непрочитане, друзі онлайн і в що грають,
 * завдання дня й рівень сезону. Один легкий запит раз на 30 хвилин (mobile/lib/pulse_widget.dart).
 */
class WidgetApiController extends ApiController
{
    public function pulse(Request $request, FriendshipService $friendships, ModuleManager $modules): JsonResponse
    {
        $user = $this->user($request);
        $online = $friendships->friendsQuery($user)->where('last_seen_at', '>=', now()->subMinutes(5));
        $playing = (clone $online)->where('playing_until', '>', now())->latest('last_seen_at')->limit(3)->get()
            ->map(fn (User $friend) => ['name' => $friend->first_name ?: $friend->name, 'label' => $friend->playing()['label'] ?? null])
            ->filter(fn (array $row) => $row['label'] !== null)->values();

        $quests = null;
        $season = null;
        if ($modules->enabled('quests')) {
            $board = app(DailyQuests::class)->board($user);
            $quests = ['done' => count(array_filter($board, fn (array $q) => $q['done'])), 'total' => count($board)];
            $pass = app(SeasonPass::class)->board($user);
            $season = ['level' => $pass['level'], 'max' => $pass['max_level']];
        }

        return response()->json([
            'name' => $user->first_name ?: $user->name,
            'messages' => $modules->enabled('messages') ? app(Messenger::class)->unreadConversations($user) : 0,
            'notifications' => NotifyPrefs::unreadCount($user),
            'friend_requests' => $friendships->incomingCount($user),
            'friends_online' => $online->count(),
            'playing' => $playing,
            'quests' => $quests,
            'season' => $season,
        ]);
    }
}
