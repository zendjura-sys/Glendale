<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

class GroupInvite extends Notification
{
    public function __construct(
        public readonly User $actor,
        public readonly string $name,
        public readonly string $url,
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
            'kind' => 'group_invite',
            'actor_id' => $this->actor->id,
            'text' => 'запрошує в '.$this->name,
            'excerpt' => null,
            'url' => $this->url,
        ];
    }
}
