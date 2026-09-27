<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],


    /*
     * Заготовка під майбутній Discord-бот (окремий проєкт, поки без
     * конкретних команд/логіки) — SDK team-reflex/discord-php вже
     * підключено, консольна команда `discord:bot` в
     * app/Console/Commands/DiscordBotServe.php вміє підʼєднатись і
     * логувати базові події. Без токена команда сама відмовляється
     * стартувати, тому на проді нічого не зациклиться, поки бот не
     * налаштований.
     */
    'discord' => [
        'token' => env('DISCORD_BOT_TOKEN'),
    ],

    /*
     * Маршрут /api/nfe/emitir из другого проекта в этом же репозитории.
     * По умолчанию выключен: он публичный, без CSRF и принимает чужой
     * сертификат с паролем. Включать только вместе с авторизацией.
     */
    'nfe' => [
        'enabled' => (bool) env('NFE_ENDPOINT_ENABLED', false),
    ],


    // Токен лише для читання релізів приватного zendjura-sys/Glendale
    // (APK застосунку). Fine-grained: Contents — Read-only, один репозиторій.
    'github' => [
        'releases_token' => env('GITHUB_RELEASES_TOKEN'),
    ],

];
