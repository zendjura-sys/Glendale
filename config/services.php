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

    'kodik' => [
        'token' => env('KODIK_TOKEN'),
        'api_url' => env('KODIK_API_URL', 'https://kodik-api.com'),
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

    'omdb' => [
        'key' => env('OMDB_KEY'),
        'api_url' => env('OMDB_API_URL', 'https://www.omdbapi.com'),
    ],

    'kinopoisk' => [
        'key' => env('KINOPOISK_KEY'),
        'api_url' => env('KINOPOISK_API_URL', 'https://kinopoiskapiunofficial.tech'),
    ],

    'shikimori' => [
        'url' => env('SHIKIMORI_URL', 'https://shikimori.one'),
    ],

];
