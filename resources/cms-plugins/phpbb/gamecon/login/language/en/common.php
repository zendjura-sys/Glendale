<?php

if (! defined('IN_PHPBB')) {
    exit;
}
$lang = array_merge(isset($lang) ? $lang : [], [
    'GAMECON_LOGIN' => 'Sign in with GameCon',
    'GAMECON_NOT_CONFIGURED' => 'Sign in with GameCon is not configured yet.',
    'ACP_GAMECON' => 'GameCon',
    'ACP_GAMECON_SETTINGS' => 'Settings',
    'ACP_GAMECON_EXPLAIN' => 'Create an app on GameCon (Developers), set the redirect URI below and paste Client ID and Secret.',
    'ACP_GAMECON_BASE' => 'GameCon address',
    'ACP_GAMECON_SECRET_SET' => 'Saved. Leave empty to keep.',
    'LOG_GAMECON_SETTINGS' => '<strong>GameCon login settings changed</strong>',
]);
