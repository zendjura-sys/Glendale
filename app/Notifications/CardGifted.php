<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Друг подарував колекційну картку. */
class CardGifted extends Notification
{
    public function __construct(public readonly User $actor, public readonly string $card, public readonly string $rank) {}

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
            'kind' => 'card_gift',
            'actor_id' => $this->actor->id,
            'text' => "дарує вам картку «{$this->card}» ({$this->rank})",
            'excerpt' => null,
            'url' => '/cards',
        ];
    }
}
