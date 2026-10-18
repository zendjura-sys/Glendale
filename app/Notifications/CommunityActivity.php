<?php

namespace App\Notifications;

use App\Models\Community;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class CommunityActivity extends Notification
{
    public const REQUEST = 'community_request';

    public const APPROVED = 'community_approved';

    public const WELCOME = 'community_welcome';

    public const POST_PENDING = 'community_post_pending';

    public const POST_APPROVED = 'community_post_approved';

    public const POST_REJECTED = 'community_post_rejected';

    public function __construct(
        public readonly string $kind,
        public readonly ?User $actor,
        public readonly Community $community,
        public readonly ?int $postId = null,
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
        $name = $this->community->name;

        return [
            'kind' => $this->kind,
            'actor_id' => $this->actor?->id,
            'community_id' => $this->community->id,
            'text' => match ($this->kind) {
                self::REQUEST => "хоче вступити до «{$name}»",
                self::WELCOME => "«{$name}»: ".Str::limit(trim((string) $this->community->welcome), 300),
                self::POST_PENDING => "надіслав запис на перевірку в «{$name}»",
                self::POST_APPROVED => "Ваш запис у «{$name}» опубліковано",
                self::POST_REJECTED => "Ваш запис у «{$name}» відхилено",
                default => "Вашу заявку до «{$name}» схвалено",
            },
            'url' => match ($this->kind) {
                self::REQUEST => route('communities.members', [$this->community, 'tab' => 'requests'], absolute: false),
                self::WELCOME => route('communities.rules', $this->community, absolute: false),
                self::POST_PENDING => route('communities.show', [$this->community, 'queue' => 1], absolute: false),
                self::POST_APPROVED => $this->postId ? route('posts.show', $this->postId, absolute: false) : route('communities.show', $this->community, absolute: false),
                default => route('communities.show', $this->community, absolute: false),
            },
        ];
    }
}
