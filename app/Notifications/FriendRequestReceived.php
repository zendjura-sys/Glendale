<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

class FriendRequestReceived extends Notification
{
    public function __construct(public readonly User $from) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'friend_request',
            'actor_id' => $this->from->id,
            'text' => 'хоче додати вас у друзі',
            'url' => route('friends.index', ['tab' => 'requests'], absolute: false),
        ];
    }
}
