<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Отримувачу: хтось подарував GameCon+. */
class PlusGifted extends Notification
{
    public function __construct(public readonly User $actor, public readonly int $days) {}

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
            'kind' => 'plus_gifted',
            'actor_id' => $this->actor->id,
            'text' => $this->days >= 365 ? 'дарує вам GameCon+ на рік' : 'дарує вам GameCon+ на місяць',
            'excerpt' => null,
            'url' => '/plus',
        ];
    }
}
