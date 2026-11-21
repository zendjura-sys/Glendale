<?php

namespace App\Notifications;

use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Сповіщення від гри чи застосунку розробника (GameCon SDK): запрошення в лобі, матч знайдено тощо. */
class AppNotice extends Notification
{
    public function __construct(
        public readonly string $app,
        public readonly string $text,
        public readonly ?string $excerpt,
        public readonly string $url,
        public readonly string $type = 'app',
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'app');
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return ['kind' => $this->type, 'app' => $this->app, 'text' => $this->text, 'excerpt' => $this->excerpt, 'url' => $this->url];
    }
}
