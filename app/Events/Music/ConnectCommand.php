<?php

namespace App\Events\Music;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * GameCon Connect: команда пристрою (пауза, далі, перемотка, «Грати тут»). Вкладка сайту з цим пристроєм
 * виконує її одразу; застосунок отримає ту саму команду з heartbeat (повтор відсіюється за id).
 */
class ConnectCommand implements ShouldBroadcastNow
{
    /**
     * @param  array<string, mixed>  $command
     */
    public function __construct(public int $userId, public string $targetDeviceId, public array $command) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("App.Models.User.{$this->userId}");
    }

    public function broadcastAs(): string
    {
        return 'connect.command';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['target_device_id' => $this->targetDeviceId, 'command' => $this->command];
    }
}
