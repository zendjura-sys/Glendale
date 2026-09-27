<?php

return [
    /*
     * VAPID-ключі підписують push-повідомлення, щоб браузер довіряв
     * відправнику. Генеруються один раз на середовище й лежать у .env —
     * без них push просто не працює (WebPushSender мовчки нічого не шле,
     * так само як TelegramClient без токена).
     */
    'vapid' => [
        'subject' => env('APP_URL', 'https://gamecon.online'),
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
    ],
];
