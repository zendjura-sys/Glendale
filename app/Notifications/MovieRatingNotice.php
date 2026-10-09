<?php

namespace App\Notifications;

use App\Models\Movie;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

class MovieRatingNotice extends Notification
{
    public function __construct(
        public readonly User $actor,
        public readonly Movie $movie,
        public readonly int $rating,
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
            'kind' => 'movie_rating',
            'actor_id' => $this->actor->id,
            'text' => 'оцінив(-ла) «'.$this->movie->title.'» на '.$this->rating,
            'url' => '/cinema/'.$this->movie->slug,
        ];
    }
}
