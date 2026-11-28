<?php

namespace App\Notifications;

use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Новий рівень профілю. */
class LevelUp extends Notification
{
    public function __construct(public readonly int $level, public readonly string $title) {}

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
            'kind' => 'level_up',
            'actor_id' => null,
            'text' => "Новий рівень профілю: {$this->level} — «{$this->title}»",
            'excerpt' => null,
            'url' => '/level',
        ];
    }
}
