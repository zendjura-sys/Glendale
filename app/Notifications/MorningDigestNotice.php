<?php

namespace App\Notifications;

use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Ранковий дайджест: що чекає сьогодні. */
class MorningDigestNotice extends Notification
{
    /**
     * @param  list<string>  $lines
     */
    public function __construct(public readonly array $lines) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'morning_digest');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'morning_digest',
            'actor_id' => null,
            'text' => 'Доброго ранку! Ось що на сьогодні',
            'excerpt' => implode(' · ', $this->lines),
            'url' => '/feed',
        ];
    }
}
