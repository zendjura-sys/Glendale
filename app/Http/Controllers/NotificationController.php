<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Family;
use App\Models\User;
use App\Support\NotifyPrefs;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = NotifyPrefs::visible($request->user()->notifications())->latest()->limit(30)->get();
        $actors = User::query()
            ->whereIn('id', $notifications->pluck('data.actor_id')->filter()->unique())
            ->get()
            ->keyBy('id');
        $communities = Community::query()
            ->whereIn('id', $notifications->pluck('data.community_id')->filter()->unique())
            ->get()
            ->keyBy('id');
        $families = Family::query()
            ->whereIn('id', $notifications->pluck('data.family_id')->filter()->unique())
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
                    isset($n->data['family_id'], $families[$n->data['family_id']]) => [
                        'id' => $families[$n->data['family_id']]->id,
                        'name' => '['.$families[$n->data['family_id']]->tag.']',
                        'avatar_url' => $families[$n->data['family_id']]->logo_url,
                    ],
                    isset($n->data['community_id'], $communities[$n->data['community_id']]) => [
                        'id' => $communities[$n->data['community_id']]->id,
                        'name' => '',
                        'avatar_url' => $communities[$n->data['community_id']]->avatar_url,
                    ],
                    default => null,
                },
                // Тривога: червона (в укриття) чи жовта (увага), тип API й час події — для окремої картки.
                'alert' => str_starts_with((string) ($n->data['kind'] ?? ''), 'air_alert') ? [
                    'severity' => $n->data['severity'] ?? 'red',
                    'type' => $n->data['alert_type'] ?? 'AIR',
                    'ended' => ($n->data['kind'] ?? '') === 'air_alert_end',
                    'region' => $n->data['region'] ?? null,
                ] : null,
                'read' => $n->read_at !== null,
                // Час події тривоги — коли її побачило опитування API, а не коли спрацювала черга.
                'created_at' => (string) ($n->data['event_at'] ?? $n->created_at->toIso8601String()),
            ])->values(),
            'unread' => NotifyPrefs::unreadCount($request->user()),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['unread' => 0]);
    }
}
