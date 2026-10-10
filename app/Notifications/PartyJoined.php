<?php

namespace App\Notifications;

use App\Models\PartyPost;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Автору оголошення: хтось приєднався до пати. */
class PartyJoined extends Notification
{
    public function __construct(
        public readonly User $actor,
        public readonly PartyPost $party,
        public readonly ?string $role,
    ) {}

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
            'kind' => 'party_join',
            'actor_id' => $this->actor->id,
            'text' => 'приєднується до пати «'.$this->party->title.'»',
            'excerpt' => $this->role,
            'url' => '/party/'.$this->party->id,
        ];
    }
}
