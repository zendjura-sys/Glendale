<?php

namespace App\Notifications;

use App\Models\PartyPost;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Автор паті кличе гравця з підбору тиммейтів. */
class PartyInvite extends Notification
{
    public function __construct(public readonly User $actor, public readonly PartyPost $party) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'party_invite');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'party_invite',
            'actor_id' => $this->actor->id,
            'text' => 'кличе вас у паті',
            'excerpt' => $this->party->title,
            'url' => '/party/'.$this->party->id,
        ];
    }
}
