<?php

namespace App\Notifications;

use App\Models\PartyPost;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Учасникам і тим, хто голосував: автор паті закріпив час гри. */
class PartyTimePicked extends Notification
{
    public function __construct(
        public readonly User $actor,
        public readonly PartyPost $party,
        public readonly string $when,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'party_time');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'party_time',
            'actor_id' => $this->actor->id,
            'text' => 'закріплює час паті «'.$this->party->title.'»',
            'excerpt' => $this->when,
            'url' => '/party/'.$this->party->id,
        ];
    }
}
