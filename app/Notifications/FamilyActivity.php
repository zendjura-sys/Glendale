<?php

namespace App\Notifications;

use App\Models\Family;
use Illuminate\Notifications\Notification;

class FamilyActivity extends Notification
{
    public function __construct(
        public readonly string $kind,
        public readonly Family $family,
        public readonly string $text,
        public readonly string $url,
        public readonly ?int $actorId = null,
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
            'kind' => 'family_'.$this->kind,
            'actor_id' => $this->actorId,
            'family_id' => $this->family->id,
            'text' => $this->text,
            'url' => $this->url,
        ];
    }
}
