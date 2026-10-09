<?php

namespace App\Events\Calls;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Стан дзвінка змінився: бесіда показує плашку «Іде дзвінок», а запрошені — вхідний дзвінок
 * (або перестають дзвонити, коли дзвінок прийняли, відхилили чи завершили).
 */
class CallUpdated implements ShouldBroadcastNow
{
    /**
     * @param  list<int>  $userIds  кому надіслати в особистий канал
     * @param  array<string, mixed>|null  $call  стан дзвінка; null — завершено
     */
    public function __construct(public int $conversationId, public array $userIds, public ?array $call) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("conversation.{$this->conversationId}"),
            ...array_map(fn (int $id) => new PrivateChannel("App.Models.User.{$id}"), $this->userIds),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['conversation_id' => $this->conversationId, 'call' => $this->call];
    }
}
