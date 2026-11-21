<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Сповіщення про тип акаунта: запрошення до складу, рішення щодо верифікації. */
class AccountNotice extends Notification
{
    public function __construct(
        public readonly string $kind,
        public readonly ?User $actor,
        public readonly string $text,
        public readonly string $excerpt,
        public readonly string $url,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, $this->kind);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'actor_id' => $this->actor?->id,
            'text' => $this->text,
            'excerpt' => $this->excerpt,
            'url' => $this->url,
        ];
    }
}
