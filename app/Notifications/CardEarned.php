<?php

namespace App\Notifications;

use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Зароблено картку за перегляд чи гру — чекає відкриття. */
class CardEarned extends Notification
{
    public function __construct(public readonly string $title, public readonly string $source) {}

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
        $why = match ($this->source) {
            'game' => "за гру в «{$this->title}»",
            'episodes' => "за серії «{$this->title}»",
            default => "за перегляд «{$this->title}»",
        };

        return [
            'kind' => 'card_earned',
            'actor_id' => null,
            'text' => "Нова картка {$why} — відкрийте її",
            'excerpt' => null,
            'url' => '/cards?drops=1',
        ];
    }
}
