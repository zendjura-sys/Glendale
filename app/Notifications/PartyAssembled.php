<?php

namespace App\Notifications;

use App\Models\PartyPost;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Усім у паті: місця заповнені, голосова кімната готова — одне натискання, і ви в ній. */
class PartyAssembled extends Notification
{
    public function __construct(
        public readonly PartyPost $party,
        public readonly int $roomId,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'party_full');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'party_full',
            'actor_id' => null,
            'text' => 'Паті «'.$this->party->title.'» зібрана — голосова кімната готова',
            'excerpt' => 'Натисніть, щоб одразу зайти в голосову.',
            'url' => '/party/'.$this->party->id.'?voice='.$this->roomId,
        ];
    }
}
