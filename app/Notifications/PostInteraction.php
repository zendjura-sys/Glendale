<?php

namespace App\Notifications;

use App\Models\Post;
use App\Models\User;
use Illuminate\Notifications\Notification;

class PostInteraction extends Notification
{
    public const LIKE = 'post_like';

    public const COMMENT = 'post_comment';

    public const WALL = 'wall_post';

    public function __construct(
        public readonly string $kind,
        public readonly User $actor,
        public readonly Post $post,
        public readonly ?string $excerpt = null,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind,
            'actor_id' => $this->actor->id,
            'post_id' => $this->post->id,
            'text' => match ($this->kind) {
                self::LIKE => 'оцінив(-ла) ваш запис',
                self::COMMENT => 'прокоментував(-ла) ваш запис',
                default => 'залишив(-ла) запис на вашій стіні',
            },
            'excerpt' => $this->excerpt,
            'url' => route('posts.show', $this->post, absolute: false),
        ];
    }
}
