<?php

/**
 * SMF 2.1: «Увійти через GameCon» — ?action=gamecon → GameCon → ?action=gamecon;callback.
 */
if (! defined('SMF')) {
    die('No direct access...');
}

function GameCon_Actions(&$actions)
{
    $actions['gamecon'] = ['GameCon.php', 'GameCon_Action'];
}

function GameCon_Language()
{
    loadLanguage('GameCon');
}

function GameCon_Settings(&$config_vars)
{
    global $txt, $scripturl;
    $config_vars[] = ['title', 'gamecon_title'];
    $config_vars[] = ['desc', 'gamecon_redirect', 'label' => sprintf($txt['gamecon_redirect_desc'], $scripturl.'?action=gamecon;callback')];
    $config_vars[] = ['text', 'gamecon_client_id', 40];
    $config_vars[] = ['password', 'gamecon_client_secret', 40];
    $config_vars[] = ['text', 'gamecon_base', 40];
}

function GameCon_Menu(&$buttons)
{
    global $user_info, $modSettings, $txt, $scripturl;
    if (! $user_info['is_guest'] || empty($modSettings['gamecon_client_id'])) {
        return;
    }
    $buttons['gamecon'] = [
        'title' => $txt['gamecon_login'],
        'href' => $scripturl.'?action=gamecon',
        'show' => true,
        'icon' => 'login',
    ];
}

function GameCon_Client()
{
    global $modSettings, $sourcedir, $scripturl;
    require_once $sourcedir.'/GameCon/GameConClient.php';

    return new GameConClient(
        isset($modSettings['gamecon_base']) ? $modSettings['gamecon_base'] : '',
        isset($modSettings['gamecon_client_id']) ? $modSettings['gamecon_client_id'] : '',
        isset($modSettings['gamecon_client_secret']) ? $modSettings['gamecon_client_secret'] : '',
        $scripturl.'?action=gamecon;callback',
        'profile email'
    );
}

function GameCon_Action()
{
    global $smcFunc, $sourcedir, $modSettings, $txt;
    $client = GameCon_Client();
    if (! $client->configured()) {
        fatal_error($txt['gamecon_not_configured'], false);
    }
    if (! isset($_GET['callback'])) {
        $auth = $client->authorize();
        $_SESSION['gamecon'] = ['state' => $auth['state'], 'verifier' => $auth['verifier']];
        redirectexit($auth['url']);
    }
    $flow = isset($_SESSION['gamecon']) ? $_SESSION['gamecon'] : [];
    unset($_SESSION['gamecon']);
    try {
        $profile = $client->callback($_GET, isset($flow['state']) ? $flow['state'] : '', isset($flow['verifier']) ? $flow['verifier'] : '');
    } catch (Exception $e) {
        fatal_error($smcFunc['htmlspecialchars']($e->getMessage()), false);
    }

    $request = $smcFunc['db_query']('', 'SELECT id_member FROM {db_prefix}gamecon_links WHERE gamecon_id = {string:id}', ['id' => $profile['id']]);
    list($id) = $smcFunc['db_fetch_row']($request) ?: [0];
    $smcFunc['db_free_result']($request);

    if (! $id && $profile['email'] && $profile['email_verified']) {
        $request = $smcFunc['db_query']('', 'SELECT id_member FROM {db_prefix}members WHERE email_address = {string:email} LIMIT 1', ['email' => $profile['email']]);
        list($id) = $smcFunc['db_fetch_row']($request) ?: [0];
        $smcFunc['db_free_result']($request);
    }
    if (! $id) {
        require_once $sourcedir.'/Subs-Members.php';
        $name = GameConClient::safeUsername($profile['username'], 25);
        $base = $name;
        for ($i = 2; isReservedName($name, 0, true, false); $i++) {
            $name = $base.$i;
        }
        $password = GameConClient::random(16);
        $id = registerMember([
            'interface' => 'guest',
            'username' => $name,
            'email' => $profile['email'] ?: GameConClient::placeholderEmail($profile, parse_url($GLOBALS['boardurl'], PHP_URL_HOST)),
            'password' => $password,
            'password_check' => $password,
            'check_reserved_name' => true,
            'check_password_strength' => false,
            'check_email_ban' => false,
            'send_welcome_email' => false,
            'require' => 'nothing',
            'extra_register_vars' => ['real_name' => $profile['name'] !== '' ? $profile['name'] : $name],
            'theme_vars' => [],
        ], true);
        if (is_array($id)) {
            fatal_error(implode(' ', $id), false);
        }
    }
    $smcFunc['db_insert']('replace', '{db_prefix}gamecon_links', ['id_member' => 'int', 'gamecon_id' => 'string'], [(int) $id, $profile['id']], ['id_member']);

    $request = $smcFunc['db_query']('', 'SELECT passwd, password_salt FROM {db_prefix}members WHERE id_member = {int:id}', ['id' => (int) $id]);
    $row = $smcFunc['db_fetch_assoc']($request);
    $smcFunc['db_free_result']($request);
    require_once $sourcedir.'/Subs-Auth.php';
    setLoginCookie(60 * (isset($modSettings['cookieTime']) ? $modSettings['cookieTime'] : 3153600), (int) $id, hash_salt($row['passwd'], $row['password_salt']));
    updateMemberData((int) $id, ['last_login' => time()]);
    redirectexit();
}
