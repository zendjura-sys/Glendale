<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Хтось зайшов у голосову кімнату, вийшов або кімнати змінилися — сторінки сім’ї чи спільноти оновлюють список.
 */
class VoiceRoomsChanged implements ShouldBroadcastNow
{
    public function __construct(public string $ownerType, public int $ownerId) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("{$this->ownerType}.{$this->ownerId}");
    }

    public function broadcastAs(): string
    {
        return 'voice.changed';
    }

    /**
     * @return array<string, int|string>
     */
    public function broadcastWith(): array
    {
        return ['owner_type' => $this->ownerType, 'owner_id' => $this->ownerId];
    }
}
