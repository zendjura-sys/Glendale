<?php

namespace App\Notifications;

use App\Models\User;
use App\Notifications\Concerns\QuietHours;
use Illuminate\Notifications\Notification;

/** Керівник сім’ї чи клану кличе учасника, який давно не заходив. */
class ComeBackNudge extends Notification
{
    /** Скільки днів без входу вважаємо «давно не заходив». */
    public const DAYS = 14;

    public function __construct(
        public readonly User $actor,
        public readonly string $name,
        public readonly string $url,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return QuietHours::channels($notifiable);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'come_back',
            'actor_id' => $this->actor->id,
            'text' => 'кличе вас назад у '.$this->name.' — на вас чекають',
            'excerpt' => null,
            'url' => $this->url,
        ];
    }

    /**
     * Нагадати можна, якщо людина не заходила два тижні, і не частіше разу на три дні.
     */
    public static function allowed(User $target, string $scope): bool
    {
        $away = $target->last_seen_at === null || $target->last_seen_at->lt(now()->subDays(self::DAYS));

        return $away && cache()->add('nudge.'.$scope.'.'.$target->id, true, now()->addDays(3));
    }
}
