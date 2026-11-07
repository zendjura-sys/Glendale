<?php

namespace App\Notifications;

use App\Support\NotifyPrefs;
use Illuminate\Notifications\Notification;

/** Тривога чи відбій в обраній людиною області — приходить і в тихі години. */
class AirAlertNotice extends Notification
{
    public function __construct(public readonly bool $started, public readonly string $region) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return NotifyPrefs::channels($notifiable, 'air_alert', honorQuiet: false);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->started ? 'air_alert' : 'air_alert_end',
            'actor_id' => null,
            'text' => $this->started ? 'Повітряна тривога: '.$this->region : 'Відбій тривоги: '.$this->region,
            'excerpt' => $this->started ? 'Пройдіть в укриття' : 'Можна виходити з укриття',
            'url' => '/alerts',
        ];
    }
}
