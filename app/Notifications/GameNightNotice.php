<?php

namespace App\Notifications;

use App\Models\GameNight;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Ігровий вечір: запрошення (invite) або остаточні час і гра (set). */
class GameNightNotice extends Notification
{
    public function __construct(
        public readonly User $actor,
        public readonly GameNight $night,
        public readonly string $type,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'game_night_'.$this->type);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $when = $this->night->starts_at?->timezone(config('app.timezone'))->format('d.m H:i');

        return [
            'kind' => 'game_night_'.$this->type,
            'actor_id' => $this->actor->id,
            'text' => $this->type === 'set'
                ? $this->actor->name.' призначає ігровий вечір'.($when ? ' на '.$when : '')
                : $this->actor->name.' кличе на ігровий вечір — проголосуйте за час і гру',
            'excerpt' => $this->night->title,
            'url' => '/game-nights/'.$this->night->id,
        ];
    }
}
