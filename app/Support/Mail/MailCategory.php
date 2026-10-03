<?php

namespace App\Support\Mail;

use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

/**
 * Дві скриньки одного домену: пошта розкладає листи по вкладках за відправником і текстом.
 * Службові (пароль, підтвердження) — «Оповіщення», події друзів і стрічки — «Соцмережі».
 * Вкладку обирає Gmail або Яндекс; різні адреси й різний текст — те, за чим вони вчаться.
 */
class MailCategory
{
    public const UPDATES = 'updates';

    public const SOCIAL = 'social';

    public static function address(string $category): string
    {
        if ($category === self::SOCIAL) {
            $social = config('mail.social.address');
            if (is_string($social) && $social !== '') {
                return $social;
            }

            $from = self::address(self::UPDATES);
            $at = strrpos($from, '@');

            return $at === false ? 'social@localhost' : 'social'.substr($from, $at);
        }

        $updates = config('mail.updates.address');
        if (is_string($updates) && $updates !== '') {
            return $updates;
        }

        return (string) config('mail.from.address');
    }

    public static function categoryOf(Email $email): string
    {
        if (! $email->getHeaders()->has('X-GameCon-Category')) {
            return self::UPDATES;
        }

        $value = strtolower(trim($email->getHeaders()->get('X-GameCon-Category')->getBodyAsString()));

        return $value === self::SOCIAL ? self::SOCIAL : self::UPDATES;
    }

    /**
     * Останній крок перед відправкою: адреса, ім’я і заголовки за типом листа.
     */
    public static function apply(Email $email): void
    {
        $category = self::categoryOf($email);
        $current = $email->getFrom()[0] ?? null;
        $name = (string) config('mail.from.name', config('app.name'));

        if ($category === self::SOCIAL && $current instanceof Address && $current->getName() !== '') {
            $name = $current->getName();
        }

        $email->from(new Address(self::address($category), $name));

        self::header($email, 'Auto-Submitted', 'auto-generated');
        self::header($email, 'X-Auto-Response-Suppress', 'All');
        self::header($email, 'Feedback-ID', $category === self::SOCIAL
            ? 'social:activity:site:gamecon'
            : 'updates:account:site:gamecon');
        self::header($email, 'X-GameCon-Category', $category);
    }

    private static function header(Email $email, string $name, string $value): void
    {
        $headers = $email->getHeaders();
        if ($headers->has($name)) {
            $headers->remove($name);
        }

        $headers->addTextHeader($name, $value);
    }
}
