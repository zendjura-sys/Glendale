<?php

namespace App\Notifications;

use App\Models\ListenParty;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Учасник групи відкрив кімнату «Слухати разом». */
class ListenRoomStarted extends Notification
{
    public function __construct(public readonly User $actor, public readonly ListenParty $party, public readonly string $group) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'listen_room');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'listen_room',
            'actor_id' => $this->actor->id,
            'text' => 'відкрив(-ла) кімнату «Слухати разом» · '.$this->group,
            'excerpt' => $this->party->title,
            'url' => '/listen/'.$this->party->code,
        ];
    }
}
