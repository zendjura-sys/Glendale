<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Спільне прослуховування: ведучий змінив трек, паузу чи позицію, хтось додав у чергу або зайшов.
 */
class ListenPartyUpdated implements ShouldBroadcastNow
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(public int $partyId, public array $payload) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("listen.{$this->partyId}");
    }

    public function broadcastAs(): string
    {
        return 'listen.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
