<?php

namespace App\Notifications;

use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Щотижневий дайджест: найкраще в друзів, нові серії, роздачі. */
class WeeklyDigestNotice extends Notification
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
        return QuietHours::channels($notifiable, 'weekly_digest');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'weekly_digest',
            'actor_id' => null,
            'text' => 'Тиждень у GameCon: що ви могли пропустити',
            'excerpt' => implode(' · ', $this->lines),
            'url' => '/feed',
        ];
    }
}
