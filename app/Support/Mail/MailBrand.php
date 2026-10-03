<?php

namespace App\Support\Mail;

use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Part\DataPart;
use Symfony\Component\Mime\Part\File;

/**
 * Фігурний знак у листі: картинка всередині листа, а не посилання,
 * щоб її було видно без окремого дозволу «показати зображення».
 */
class MailBrand
{
    public const CONTENT_ID = 'logo@gamecon.online';

    public static function src(): string
    {
        return 'cid:'.self::CONTENT_ID;
    }

    public static function embed(Email $email): void
    {
        $html = $email->getHtmlBody();
        if (! is_string($html) || ! str_contains($html, self::src())) {
            return;
        }

        foreach ($email->getAttachments() as $part) {
            if ($part->getContentId() === self::CONTENT_ID) {
                return;
            }
        }

        $part = (new DataPart(new File(public_path('images/mail-logo.png')), 'logo.png', 'image/png'))->asInline();
        $part->setContentId(self::CONTENT_ID);
        $email->addPart($part);
    }
}
