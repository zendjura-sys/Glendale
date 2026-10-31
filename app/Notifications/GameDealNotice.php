<?php

namespace App\Notifications;

use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Безкоштовна роздача або знижка на гру зі списку бажаного. */
class GameDealNotice extends Notification
{
    /**
     * @param  'giveaway'|'price_drop'  $kind
     */
    public function __construct(public readonly string $kind, public readonly string $text, public readonly string $excerpt, public readonly string $url) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, $this->kind);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'actor_id' => null,
            'text' => $this->text,
            'excerpt' => $this->excerpt,
            'url' => $this->url,
        ];
    }
}
