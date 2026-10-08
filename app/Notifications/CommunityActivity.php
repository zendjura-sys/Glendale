<?php

namespace App\Notifications;

use App\Models\Community;
use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

class CommunityActivity extends Notification
{
    public const REQUEST = 'community_request';

    public const APPROVED = 'community_approved';

    public function __construct(
        public readonly string $kind,
        public readonly ?User $actor,
        public readonly Community $community,
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
            'kind' => $this->kind,
            'actor_id' => $this->actor?->id,
            'community_id' => $this->community->id,
            'text' => match ($this->kind) {
                self::REQUEST => "хоче вступити до «{$this->community->name}»",
                default => "Вашу заявку до «{$this->community->name}» схвалено",
            },
            'url' => $this->kind === self::REQUEST
                ? route('communities.members', [$this->community, 'tab' => 'requests'], absolute: false)
                : route('communities.show', $this->community, absolute: false),
        ];
    }
}
