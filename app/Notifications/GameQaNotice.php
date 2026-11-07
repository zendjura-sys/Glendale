<?php

namespace App\Notifications;

use App\Models\GameQuestion;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Авторові питання про гру: нова відповідь. */
class GameQaNotice extends Notification
{
    public function __construct(
        public readonly User $actor,
        public readonly GameQuestion $question,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'game_answer');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'game_answer',
            'actor_id' => $this->actor->id,
            'text' => $this->actor->name.' відповідає на ваше питання',
            'excerpt' => $this->question->title,
            'url' => '/games/'.$this->question->game?->slug.'?question='.$this->question->id.'#questions',
        ];
    }
}
