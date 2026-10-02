<?php

namespace App\Events\Messenger;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

class ConversationUpdated implements ShouldBroadcastNow
{
    public function __construct(public int $conversationId) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("conversation.{$this->conversationId}");
    }

    public function broadcastAs(): string
    {
        return 'conversation.updated';
    }

    /**
     * @return array<string, int>
     */
    public function broadcastWith(): array
    {
        return ['id' => $this->conversationId];
    }
}
