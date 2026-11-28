<?php

namespace App\Notifications;

use App\Models\User;
use App\Support\Mail\AccountMail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Вхід з нового пристрою: сповіщення в дзвіночку й лист (лист можна вимкнути в «Акаунті»).
 * Без тихих годин — це безпека, а не новина.
 */
class NewLoginNotice extends Notification
{
    public function __construct(
        public readonly string $device,
        public readonly ?string $ip,
        public readonly string $at,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        $mail = $notifiable instanceof User && $notifiable->email && $notifiable->hasVerifiedEmail() && $notifiable->pref('notify_new_login') !== false;

        return $mail ? ['database', 'mail'] : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return AccountMail::message(
            'Новий вхід в акаунт '.config('app.name'),
            "Хтось увійшов у ваш акаунт: {$this->device}".($this->ip ? ", IP {$this->ip}" : '').", {$this->at} (Київ). Якщо це ви — нічого робити не потрібно.",
            'Переглянути пристрої',
            url('/settings/account'),
            'Не впізнаєте вхід? Змініть пароль і натисніть «Завершити всі інші сесії» в налаштуваннях акаунта.',
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'new_login',
            'actor_id' => null,
            'text' => 'Новий вхід: '.$this->device,
            'excerpt' => trim(($this->ip ? 'IP '.$this->ip.' · ' : '').$this->at.'. Не ви? Завершіть сесію в налаштуваннях.'),
            'url' => '/settings/account',
        ];
    }
}
