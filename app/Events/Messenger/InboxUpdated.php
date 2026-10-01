<?php

namespace App\Events\Messenger;

use App\Models\ConversationParticipant;
use App\Models\User;
use App\Services\Messenger;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

/**
 * Особистий канал користувача: оновлює список бесід і лічильник непрочитаних
 * на будь-якій сторінці сайту. Йде через чергу, бо розсилається кожному учаснику.
 */
class InboxUpdated implements ShouldBroadcast
{
    /**
     * @param  array<string, mixed>|null  $message
     */
    public function __construct(public int $userId, public int $conversationId, public ?array $message) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("App.Models.User.{$this->userId}");
    }

    public function broadcastAs(): string
    {
        return 'inbox.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $user = User::query()->find($this->userId);

        return [
            'conversation_id' => $this->conversationId,
            'message' => $this->message,
            'is_muted' => (bool) ConversationParticipant::query()
                ->where('conversation_id', $this->conversationId)
                ->where('user_id', $this->userId)
                ->value('is_muted'),
            'unread_total' => $user ? app(Messenger::class)->unreadConversations($user) : 0,
        ];
    }
}
