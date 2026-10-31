<?php

namespace App\Notifications;

use App\Models\Tournament;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Новини турніру для учасника: старт, перемога, результат челенджу перевірено. */
class TournamentNotice extends Notification
{
    public function __construct(public readonly Tournament $tournament, public readonly string $text) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'tournament');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'tournament',
            'actor_id' => $this->tournament->user_id,
            'text' => $this->text,
            'excerpt' => $this->tournament->title,
            'url' => '/tournaments/'.$this->tournament->id,
        ];
    }
}
