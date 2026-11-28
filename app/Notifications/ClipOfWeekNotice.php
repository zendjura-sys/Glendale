<?php

namespace App\Notifications;

use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Кліп людини став «Кліпом тижня». */
class ClipOfWeekNotice extends Notification
{
    public function __construct(public readonly string $title, public readonly int $likes, public readonly string $url) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'clip_of_week');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'clip_of_week',
            'actor_id' => null,
            'text' => 'Ваш кліп — «Кліп тижня» в GameCon! 🏆',
            'excerpt' => $this->title.' · '.$this->likes.' ❤',
            'url' => $this->url,
        ];
    }
}
