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
 * Четверта колонка на великих екранах (2K+): друзі онлайн і останні бесіди — завжди під рукою.
 */
class RailController extends Controller
{
    public function __invoke(Request $request, FriendshipService $friendships, MessengerPresenter $presenter, Messenger $messenger, ModuleManager $modules): JsonResponse
    {
        $user = $request->user();
        $friendIds = $friendships->friendIds($user);

        return response()->json([
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
                ], array_slice($presenter->inbox($user, $messenger), 0, 8))
                : [],
        ]);
    }
}
