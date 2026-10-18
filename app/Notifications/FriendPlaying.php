<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

class FriendPlaying extends Notification
{
    public function __construct(public readonly User $actor) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'friend_playing');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'friend_playing',
            'actor_id' => $this->actor->id,
            'text' => 'зараз грає: '.($this->actor->playing_label ?? ''),
            'excerpt' => null,
            'url' => $this->actor->playing_url ?: '/'.$this->actor->username,
        ];
    }
}
