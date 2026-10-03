<?php

namespace App\Support\Mail;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Symfony\Component\Mime\Email;

/**
 * Листи акаунта: підтвердження пошти і скидання пароля. Вкладка «Оповіщення».
 */
class AccountMail
{
    public static function register(): void
    {
        VerifyEmail::toMailUsing(function ($notifiable, string $url) {
            return self::message(
                'Підтвердьте пошту '.config('app.name'),
                'Натисніть кнопку, щоб підтвердити адресу електронної пошти.',
                'Підтвердити пошту',
                $url,
                'Якщо ви не створювали акаунт, нічого робити не потрібно.',
            );
        });

        ResetPassword::toMailUsing(function ($notifiable, string $token) {
            $url = url(route('password.reset', [
                'token' => $token,
                'email' => $notifiable->getEmailForPasswordReset(),
            ], false));
            $minutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

            return self::message(
                'Скидання пароля '.config('app.name'),
                'Ви отримали цей лист, бо для акаунта запитали новий пароль.',
                'Задати новий пароль',
                $url,
                'Посилання діє '.$minutes.' хв. Якщо ви не просили змінити пароль, нічого робити не потрібно.',
            );
        });
    }

    private static function message(string $subject, string $intro, string $action, string $url, string $outro): MailMessage
    {
        return (new MailMessage)
            ->subject($subject)
            ->line($intro)
            ->action($action, $url)
            ->line($outro)
            ->withSymfonyMessage(function (Email $email) {
                $email->getHeaders()->addTextHeader('X-GameCon-Category', MailCategory::UPDATES);
            });
    }
}
