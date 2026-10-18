<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

class FriendRequestAccepted extends Notification
{
    public function __construct(public readonly User $by) {}

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
            'kind' => 'friend_accepted',
            'actor_id' => $this->by->id,
            'text' => 'прийняв(-ла) вашу заявку в друзі',
            'url' => route('profile.show', $this->by, absolute: false),
        ];
    }
}
