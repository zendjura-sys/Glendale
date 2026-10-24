<?php

namespace App\Events\Music;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * GameCon Connect: змінився список пристроїв користувача, що на них грає, або активний пристрій.
 * Вкладки сайту оновлюють віддалений режим плеєра одразу, застосунок дізнається з heartbeat.
 */
class ConnectUpdated implements ShouldBroadcastNow
{
    /**
     * @param  list<array<string, mixed>>  $devices
     */
    public function __construct(public int $userId, public array $devices, public ?string $activeDeviceId) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("App.Models.User.{$this->userId}");
    }

    public function broadcastAs(): string
    {
        return 'connect.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['devices' => $this->devices, 'active_device_id' => $this->activeDeviceId];
    }
}
