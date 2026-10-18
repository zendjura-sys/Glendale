<?php

namespace App\Notifications;

use App\Models\Photo;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

class PhotoInteraction extends Notification
{
    public const LIKE = 'photo_like';

    public const COMMENT = 'photo_comment';

    public const TAG = 'photo_tag';

    public function __construct(
        public readonly string $kind,
        public readonly User $actor,
        public readonly Photo $photo,
        public readonly ?string $excerpt = null,
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
            'actor_id' => $this->actor->id,
            'photo_id' => $this->photo->id,
            'text' => match ($this->kind) {
                self::LIKE => 'оцінив(-ла) ваше фото',
                self::TAG => 'позначив(-ла) вас на фото',
                default => 'прокоментував(-ла) ваше фото',
            },
            'excerpt' => $this->excerpt,
            'url' => route('albums.show', ['album' => $this->photo->album_id, 'photo' => $this->photo->id], absolute: false),
        ];
    }
}
