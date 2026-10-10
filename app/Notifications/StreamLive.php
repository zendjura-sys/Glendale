<?php

namespace App\Notifications;

use App\Models\User;
use App\Models\UserStream;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Друг почав стрім. */
class StreamLive extends Notification
{
    public function __construct(public readonly User $actor, public readonly UserStream $stream) {}

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
            'kind' => 'stream_live',
            'actor_id' => $this->actor->id,
            'text' => 'почав стрім на '.(UserStream::PLATFORMS[$this->stream->platform] ?? $this->stream->platform),
            'excerpt' => $this->stream->title,
            'url' => '/'.$this->actor->username,
        ];
    }
}
