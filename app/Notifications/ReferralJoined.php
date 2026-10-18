<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Запрошувачу: друг зареєструвався за його посиланням. */
class ReferralJoined extends Notification
{
    public function __construct(public readonly User $actor) {}

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
            'kind' => 'referral_joined',
            'actor_id' => $this->actor->id,
            'text' => 'приєднується до GameCon за вашим запрошенням',
            'excerpt' => null,
            'url' => '/invite',
        ];
    }
}
