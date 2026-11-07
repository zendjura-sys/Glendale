<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Запрошувачу: запрошений друг підтвердив пошту — він активний, і скільки лишилось до нагороди. */
class ReferralActivated extends Notification
{
    public function __construct(public readonly User $actor, public readonly int $active, public readonly ?int $next) {}

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
            'text' => 'тепер активний друг за вашим запрошенням',
            'excerpt' => $this->next === null
                ? 'Активних друзів: '.$this->active.' — усі нагороди отримано'
                : 'Активних друзів: '.$this->active.' — до наступної нагороди ще '.($this->next - $this->active),
            'url' => '/invite',
        ];
    }
}
