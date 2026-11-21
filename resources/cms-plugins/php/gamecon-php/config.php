<?php
require_once __DIR__.'/GameConClient.php';

function gamecon(): GameConClient
{
    return new GameConClient(
        'https://gamecon.online',
        getenv('GAMECON_CLIENT_ID') ?: '',
        getenv('GAMECON_CLIENT_SECRET') ?: '',
        'https://ваш-сайт/callback.php',
        'profile email'
    );
}
