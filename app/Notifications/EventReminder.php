<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * Нагадування про подію сім’ї, клану чи сервера за пів години до початку (у базі й push).
 */
class EventReminder extends Notification
{
    public function __construct(
        public readonly string $text,
        public readonly string $url,
        public readonly ?int $familyId = null,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'event_reminder',
            'family_id' => $this->familyId,
            'text' => $this->text,
            'url' => $this->url,
        ];
    }
}
