<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()->notifications()->latest()->limit(30)->get();
        $actors = User::query()
            ->whereIn('id', $notifications->pluck('data.actor_id')->filter()->unique())
            ->get()
            ->keyBy('id');
        $communities = Community::query()
            ->whereIn('id', $notifications->pluck('data.community_id')->filter()->unique())
            ->get()
            ->keyBy('id');

        return response()->json([
            'notifications' => $notifications->map(fn (DatabaseNotification $n) => [
                'id' => $n->id,
                'kind' => $n->data['kind'] ?? 'generic',
                'text' => $n->data['text'] ?? '',
                'excerpt' => $n->data['excerpt'] ?? null,
                'url' => $n->data['url'] ?? null,
                'actor' => match (true) {
                    isset($n->data['actor_id'], $actors[$n->data['actor_id']]) => $actors[$n->data['actor_id']]->toCard(),
                    isset($n->data['community_id'], $communities[$n->data['community_id']]) => [
                        'id' => $communities[$n->data['community_id']]->id,
                        'name' => '',
                        'avatar_url' => $communities[$n->data['community_id']]->avatar_url,
                    ],
                    default => null,
                },
                'read' => $n->read_at !== null,
                'created_at' => $n->created_at->toIso8601String(),
            ])->values(),
            'unread' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['unread' => 0]);
    }
}
