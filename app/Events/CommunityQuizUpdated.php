<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** Вікторина спільноти перейшла на нове питання, показала відповідь чи завершилась — клієнти перечитують стан. */
class CommunityQuizUpdated implements ShouldBroadcastNow
{
    public function __construct(public int $communityId, public int $quizId, public string $phase) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("community.{$this->communityId}");
    }

    public function broadcastAs(): string
    {
        return 'quiz.updated';
    }

    /**
     * @return array{quiz_id: int, phase: string}
     */
    public function broadcastWith(): array
    {
        return ['quiz_id' => $this->quizId, 'phase' => $this->phase];
    }
}
