<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Сигнал відкритим сторінкам сім’ї перезавантажити дані розділу (черга звітів, банк, склад…).
 */
class FamilyUpdated implements ShouldBroadcastNow
{
    public function __construct(public int $familyId, public string $section) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("family.{$this->familyId}");
    }

    public function broadcastAs(): string
    {
        return 'family.updated';
    }

    /**
     * @return array<string, int|string>
     */
    public function broadcastWith(): array
    {
        return ['section' => $this->section];
    }
}
