<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

class Mention extends Notification
{
    public function __construct(
        public readonly User $actor,
        public readonly string $url,
        public readonly ?string $excerpt = null,
    ) {}

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
            'kind' => 'mention',
            'actor_id' => $this->actor->id,
            'text' => 'згадав(-ла) вас',
            'excerpt' => $this->excerpt,
            'url' => $this->url,
        ];
    }
}
