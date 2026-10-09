<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Спільний перегляд: ведучий натиснув плей/паузу чи перемотав, хтось написав у чат або зайшов.
 */
class WatchPartyUpdated implements ShouldBroadcastNow
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(public int $partyId, public array $payload) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("watch.{$this->partyId}");
    }

    public function broadcastAs(): string
    {
        return 'watch.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
