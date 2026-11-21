<?php

if (! defined('IN_PHPBB')) {
    exit;
}
$lang = array_merge(isset($lang) ? $lang : [], [
    'GAMECON_LOGIN' => 'Увійти через GameCon',
    'GAMECON_NOT_CONFIGURED' => 'Вхід через GameCon ще не налаштовано.',
    'ACP_GAMECON' => 'GameCon',
    'ACP_GAMECON_SETTINGS' => 'Налаштування',
    'ACP_GAMECON_EXPLAIN' => 'Створіть застосунок на GameCon (Розробникам), вкажіть адресу повернення нижче й вставте Client ID і Secret.',
    'ACP_GAMECON_BASE' => 'Адреса GameCon',
    'ACP_GAMECON_SECRET_SET' => 'Збережено. Залиште порожнім, щоб не змінювати.',
    'LOG_GAMECON_SETTINGS' => '<strong>Змінено налаштування входу через GameCon</strong>',
]);
