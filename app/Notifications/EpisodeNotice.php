<?php

namespace App\Notifications;

use App\Models\Movie;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Нова серія тайтлу зі списку «Дивлюся». */
class EpisodeNotice extends Notification
{
    public function __construct(public readonly Movie $movie, public readonly int $from, public readonly int $to) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable, 'episode_new');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $range = $this->to > $this->from ? "{$this->from}–{$this->to}" : (string) $this->to;

        return [
            'kind' => 'episode_new',
            'actor_id' => null,
            'text' => $this->to > $this->from ? "Вийшли серії {$range}: {$this->movie->title}" : "Вийшла {$range} серія: {$this->movie->title}",
            'excerpt' => 'Ви дивитеся цей тайтл — нова серія вже на сайті.',
            'url' => '/cinema/'.$this->movie->slug,
            'image' => $this->movie->poster,
        ];
    }
}
