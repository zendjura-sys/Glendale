<?php

namespace Addons\Notifications\Services;

use Addons\Notifications\Models\Notification;
use App\Models\User;
use App\Support\MobilePushSender;
use App\Support\WebPushSender;

/**
 * Єдина точка входу для персональних сповіщень: завжди пише web-копію
 * (Notification, «дзвіночок»), дублює в браузерний push, якщо в
 * отримувача є активна підписка, і в мобільний push (FCM), якщо на
 * пристрої зареєстровано токен. Обидва відправники — класи ядра й самі
 * мовчать, якщо VAPID-ключі чи Firebase-обліковка не налаштовані.
 */
class NotificationService
{
    /**
     * @param  array{text:string,url:string}|null  $link  Куди веде сповіщення (сторінка сайту) —
     *         у «дзвіночку», браузерному й мобільному push.
     */
    public function notify(User $user, string $type, string $title, ?string $body = null, ?array $link = null): Notification
    {
        $notification = Notification::notify($user->id, $type, $title, $body, $link['url'] ?? null);

        (new WebPushSender())->sendToUser($user, $title, $body, $link['url'] ?? null);
        (new MobilePushSender())->sendToUser($user, $title, $body, $link['url'] ?? null);

        return $notification;
    }
}
