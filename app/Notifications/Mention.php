<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use App\Support\MutedWords;
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
        if ($notifiable instanceof User && MutedWords::blocks($notifiable, $this->excerpt)) {
            return [];
        }

        return QuietHours::channels($notifiable, 'mention');
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
