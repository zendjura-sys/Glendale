<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
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

    'spotify' => [
        'client_id' => env('SPOTIFY_CLIENT_ID'),
        'client_secret' => env('SPOTIFY_CLIENT_SECRET'),
        'redirect' => env('SPOTIFY_REDIRECT_URI'),
        'accounts_url' => env('SPOTIFY_ACCOUNTS_URL', 'https://accounts.spotify.com'),
        'api_url' => env('SPOTIFY_API_URL', 'https://api.spotify.com/v1'),
    ],

    'geoip' => [
        'dbip_url' => env('GEOIP_DBIP_URL', 'https://download.db-ip.com/free/dbip-country-lite-{month}.mmdb.gz'),
        'maxmind_url' => env('GEOIP_MAXMIND_URL', 'https://download.maxmind.com/geoip/databases/GeoLite2-Country/download?suffix=tar.gz'),
    ],

    // Банка Monobank для донатів сім’ям і спільнотам: публічні ендпоінти віджетів (перевизначаються для тестів).
    'monobank_jar' => [
        'send_url' => env('MONOBANK_JAR_SEND_URL', 'https://send.monobank.ua'),
        'api_url' => env('MONOBANK_JAR_API_URL', 'https://api.monobank.ua'),
    ],

    // Інтернет-еквайринг monobank: оплата карткою, Apple Pay, Google Pay, збережені картки для автопродовження.
    // Токен (X-Token) задають в адмінці (Інтеграції → monobank); тут — запасний варіант і адреса API (для тестів).
    // Google Play Billing (підписки в застосунку): пакет, адреса API (для тестів) і запасний ключ сервісного акаунта.
    'google_play' => [
        'package' => env('GOOGLE_PLAY_PACKAGE', 'online.gamecon.app'),
        'url' => env('GOOGLE_PLAY_API_URL', 'https://androidpublisher.googleapis.com'),
        'credentials' => env('GOOGLE_PLAY_CREDENTIALS'),
    ],

    'monobank_acquiring' => [
        'url' => env('MONOBANK_ACQUIRING_URL', 'https://api.monobank.ua'),
        'token' => env('MONOBANK_ACQUIRING_TOKEN'),
    ],

    // Donatello: донати для поповнення рахунку. Токен зазвичай задають в адмінці (Інтеграції → Donatello).
    'donatello' => [
        'token' => env('DONATELLO_TOKEN'),
        'url' => env('DONATELLO_URL', 'https://donatello.to/api/v1'),
    ],

    'deepl' => [
        'key' => env('DEEPL_KEY'),
        'url' => env('DEEPL_URL'),
    ],

    'discord' => [
        'client_id' => env('DISCORD_CLIENT_ID'),
        'client_secret' => env('DISCORD_CLIENT_SECRET'),
        'redirect' => env('DISCORD_REDIRECT_URI'),
        'api_url' => env('DISCORD_API_URL', 'https://discord.com/api'),
        'authorize_url' => env('DISCORD_AUTHORIZE_URL', 'https://discord.com/oauth2/authorize'),
        // Бот для статусу «Граю в…» (Rich Presence учасників Discord-сервера GameCon).
        'bot_token' => env('DISCORD_BOT_TOKEN'),
        'guild_id' => env('DISCORD_GUILD_ID'),
        'gateway' => env('DISCORD_GATEWAY_URL', 'wss://gateway.discord.gg/?v=10&encoding=json'),
    ],

    // Сервер голосових кімнат (LiveKit); можна задати в адмінці → Інтеграції.
    'livekit' => [
        'url' => env('LIVEKIT_URL'),
        'key' => env('LIVEKIT_API_KEY'),
        'secret' => env('LIVEKIT_API_SECRET'),
    ],

    'firebase' => [
        'api_key' => env('FIREBASE_API_KEY'),
        'auth_domain' => env('FIREBASE_AUTH_DOMAIN'),
        'project_id' => env('FIREBASE_PROJECT_ID'),
        'app_id' => env('FIREBASE_APP_ID'),
        // Ключ сервісного акаунта для push (JSON або шлях до файлу); можна задати в адмінці.
        'credentials' => env('FIREBASE_CREDENTIALS'),
        'fcm_url' => env('FIREBASE_FCM_URL', 'https://fcm.googleapis.com'),
        'certs_url' => env('FIREBASE_CERTS_URL', 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'),
        'tokeninfo_url' => env('GOOGLE_TOKENINFO_URL', 'https://oauth2.googleapis.com/tokeninfo'),
    ],

    'kodik' => [
        'token' => env('KODIK_TOKEN'),
        'api_url' => env('KODIK_API_URL', 'https://kodik-api.com'),
        // Партнерський метод прямих посилань (ключ видає Kodik на запит; задається в адмінці).
        'links_key' => env('KODIK_LINKS_KEY'),
        'links_url' => env('KODIK_LINKS_URL', 'https://kodik.biz/api/video-links'),
    ],

    'videoseed' => [
        'token' => env('VIDEOSEED_TOKEN'),
        'api_url' => env('VIDEOSEED_API_URL', 'https://api.videoseed.tv/apiv2.php'),
    ],

    'flixcdn' => [
        'token' => env('FLIXCDN_TOKEN'),
        'template' => env('FLIXCDN_TEMPLATE'),
        'api_search' => env('FLIXCDN_API_SEARCH'),
        'api_updates' => env('FLIXCDN_API_UPDATES'),
    ],

    'tmdb' => [
        'token' => env('TMDB_TOKEN'),
        'api_url' => env('TMDB_API_URL', 'https://api.themoviedb.org/3'),
        'image_url' => env('TMDB_IMAGE_URL', 'https://image.tmdb.org/t/p'),
    ],

    'steam' => [
        'key' => env('STEAM_API_KEY'),
        'url' => env('STEAM_API_URL', 'https://api.steampowered.com'),
    ],

    'igdb' => [
        'client_id' => env('IGDB_CLIENT_ID'),
        'client_secret' => env('IGDB_CLIENT_SECRET'),
        'url' => env('IGDB_API_URL', 'https://api.igdb.com/v4'),
        'token_url' => env('IGDB_TOKEN_URL', 'https://id.twitch.tv/oauth2/token'),
    ],

    'rawg' => [
        'key' => env('RAWG_KEY'),
        'url' => env('RAWG_API_URL', 'https://api.rawg.io/api'),
    ],

    'omdb' => [
        'key' => env('OMDB_KEY'),
        'api_url' => env('OMDB_API_URL', 'https://www.omdbapi.com'),
    ],

    'shikimori' => [
        'url' => env('SHIKIMORI_URL', 'https://shikimori.one'),
    ],

    // Звукові дані й перекодування треків (музика); не знайдено — завантаження без них.
    'ffmpeg' => [
        'ffmpeg' => env('FFMPEG_PATH', 'ffmpeg'),
        'ffprobe' => env('FFPROBE_PATH', 'ffprobe'),
    ],

    // Метадані треків: відбиток Chromaprint (fpcalc) → AcoustID → MusicBrainz, обкладинки Cover Art Archive.
    // MUSIC_METADATA=false вимикає всі зовнішні запити (у тестах — щоб не ходити в мережу).
    'music_metadata' => [
        'enabled' => (bool) env('MUSIC_METADATA', true),
    ],

    'chromaprint' => [
        'fpcalc' => env('FPCALC_PATH', 'fpcalc'),
    ],

    'acoustid' => [
        'key' => env('ACOUSTID_KEY'),
        'url' => env('ACOUSTID_API_URL', 'https://api.acoustid.org/v2'),
    ],

    'musicbrainz' => [
        'url' => env('MUSICBRAINZ_API_URL', 'https://musicbrainz.org/ws/2'),
        // Правила MusicBrainz: не частіше одного запиту на секунду з однієї адреси.
        'interval_ms' => (int) env('MUSICBRAINZ_INTERVAL_MS', 1100),
    ],

    'lastfm' => [
        'key' => env('LASTFM_KEY'),
        'url' => env('LASTFM_API_URL', 'https://ws.audioscrobbler.com/2.0/'),
    ],

    'discogs' => [
        'token' => env('DISCOGS_TOKEN'),
        'url' => env('DISCOGS_API_URL', 'https://api.discogs.com'),
        // Discogs з токеном — до 60 запитів на хвилину.
        'interval_ms' => (int) env('DISCOGS_INTERVAL_MS', 1000),
    ],

];
