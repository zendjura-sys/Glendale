<?php
/**
 * Плагін MODX «GameCon Login» — подія OnWebPageInit.
 * ?gamecon=login → GameCon → ?gamecon=callback. Зв’язок: modUser.remote_key = gamecon:<id>.
 * Системні налаштування: gamecon.client_id, gamecon.client_secret, gamecon.base_url.
 *
 * @var modX $modx
 */
if ($modx->event->name !== 'OnWebPageInit' || empty($_GET['gamecon'])) {
    return;
}
require_once MODX_CORE_PATH.'components/gamecon/lib/GameConClient.php';

$client = new GameConClient(
    (string) $modx->getOption('gamecon.base_url', null, 'https://gamecon.online'),
    (string) $modx->getOption('gamecon.client_id', null, ''),
    (string) $modx->getOption('gamecon.client_secret', null, ''),
    rtrim($modx->getOption('site_url'), '/').'/?gamecon=callback',
    'profile email'
);
if (! $client->configured()) {
    return;
}

if ($_GET['gamecon'] === 'login') {
    $auth = $client->authorize();
    $_SESSION['gamecon'] = ['state' => $auth['state'], 'verifier' => $auth['verifier'], 'back' => isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : $modx->getOption('site_url')];
    $modx->sendRedirect($auth['url']);
}

if ($_GET['gamecon'] === 'callback') {
    $flow = isset($_SESSION['gamecon']) ? $_SESSION['gamecon'] : [];
    unset($_SESSION['gamecon']);
    try {
        $profile = $client->callback($_GET, isset($flow['state']) ? $flow['state'] : '', isset($flow['verifier']) ? $flow['verifier'] : '');
    } catch (Exception $e) {
        $modx->log(modX::LOG_LEVEL_ERROR, '[GameCon] '.$e->getMessage());
        $modx->sendRedirect($modx->getOption('site_url'));

        return;
    }
    $userClass = class_exists('MODX\\Revolution\\modUser') ? 'MODX\\Revolution\\modUser' : 'modUser';
    $profileClass = class_exists('MODX\\Revolution\\modUserProfile') ? 'MODX\\Revolution\\modUserProfile' : 'modUserProfile';

    $user = $modx->getObject($userClass, ['remote_key' => 'gamecon:'.$profile['id']]);
    if (! $user && $profile['email'] && $profile['email_verified']) {
        $byEmail = $modx->getObject($profileClass, ['email' => $profile['email']]);
        if ($byEmail) {
            $user = $byEmail->getOne('User');
            $user->set('remote_key', 'gamecon:'.$profile['id']);
            $user->save();
        }
    }
    if (! $user) {
        $username = GameConClient::safeUsername($profile['username'], 100);
        $base = $username;
        for ($i = 2; $modx->getCount($userClass, ['username' => $username]); $i++) {
            $username = $base.$i;
        }
        $user = $modx->newObject($userClass);
        $user->fromArray(['username' => $username, 'active' => 1, 'remote_key' => 'gamecon:'.$profile['id']]);
        $user->set('password', GameConClient::random(24));
        $userProfile = $modx->newObject($profileClass);
        $userProfile->fromArray([
            'fullname' => $profile['name'] !== '' ? $profile['name'] : $username,
            'email' => $profile['email'] ?: GameConClient::placeholderEmail($profile, parse_url($modx->getOption('site_url'), PHP_URL_HOST)),
            'photo' => (string) $profile['avatar'],
            'website' => $profile['profile'],
        ]);
        $user->addOne($userProfile);
        if (! $user->save()) {
            $modx->log(modX::LOG_LEVEL_ERROR, '[GameCon] Не вдалося створити користувача '.$username);
            $modx->sendRedirect($modx->getOption('site_url'));

            return;
        }
        // Група за замовчуванням (за бажанням): gamecon.default_group.
        $group = (string) $modx->getOption('gamecon.default_group', null, '');
        if ($group !== '') {
            $user->joinGroup($group);
        }
    }
    $user->addSessionContext($modx->context->get('key'));
    $modx->sendRedirect(isset($flow['back']) ? $flow['back'] : $modx->getOption('site_url'));
}
