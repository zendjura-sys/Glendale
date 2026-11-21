<?php

namespace App\Notifications;

use App\Models\Broadcast;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Повідомлення від команди GameCon (розсилка з адмінки). */
class BroadcastNotice extends Notification
{
    public function __construct(public readonly Broadcast $broadcast) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'broadcast');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'broadcast',
            'text' => $this->broadcast->title,
            'excerpt' => $this->broadcast->body,
            'url' => $this->broadcast->url ?: '/notifications',
        ];
    }
}
