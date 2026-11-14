<?php

namespace App\Notifications;

use App\Models\GameNews;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Гравцям і підписникам: у гри вийшов патч (зі Steam). */
class GamePatchReleased extends Notification
{
    public function __construct(public readonly GameNews $news) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'game_patch');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $game = $this->news->game;

        return [
            'kind' => 'game_patch',
            'actor_id' => null,
            'text' => 'Новий патч у '.$game->name.': '.$this->news->title,
            'excerpt' => $this->news->excerpt,
            'url' => '/games/'.$game->slug.'#news',
        ];
    }
}
