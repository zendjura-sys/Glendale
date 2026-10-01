<?php

namespace App\Events\Messenger;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class ConversationRead implements ShouldBroadcastNow
{
    public function __construct(public int $conversationId, public int $userId, public int $messageId) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("conversation.{$this->conversationId}");
    }

    public function broadcastAs(): string
    {
        return 'conversation.read';
    }

    /**
     * @return array<string, int>
     */
    public function broadcastWith(): array
    {
        return ['user_id' => $this->userId, 'message_id' => $this->messageId];
    }
}
