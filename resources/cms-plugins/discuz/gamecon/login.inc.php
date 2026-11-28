<?php

if (! defined('IN_DISCUZ')) {
    exit('Access Denied');
}

require_once __DIR__.'/lib/GameConClient.php';
require_once libfile('function/member');

$settings = $_G['cache']['plugin']['gamecon'];
$client = new GameConClient(
    (string) $settings['base'],
    (string) $settings['client_id'],
    (string) $settings['client_secret'],
    $_G['siteurl'].'plugin.php?id=gamecon:login&mode=callback',
    'profile email'
);
if (! $client->configured()) {
    showmessage('Вхід через GameCon ще не налаштовано.');
}

if (empty($_GET['mode'])) {
    $auth = $client->authorize();
    dsetcookie('gamecon_flow', authcode($auth['state'].'|'.$auth['verifier'], 'ENCODE'), 900);
    dheader('Location: '.$auth['url']);
}

list($state, $verifier) = array_pad(explode('|', (string) authcode(getcookie('gamecon_flow'), 'DECODE'), 2), 2, '');
dsetcookie('gamecon_flow', '', -1);
try {
    $profile = $client->callback($_GET, $state, $verifier);
} catch (Exception $e) {
    showmessage($e->getMessage());
}

$uid = (int) DB::result_first('SELECT uid FROM %t WHERE gamecon_id=%s', ['gamecon_link', $profile['id']]);
if (! $uid && $profile['email'] && $profile['email_verified']) {
    $uid = (int) DB::result_first('SELECT uid FROM %t WHERE email=%s', ['common_member', $profile['email']]);
    if ($uid) {
        DB::insert('gamecon_link', ['uid' => $uid, 'gamecon_id' => $profile['id']], false, true);
    }
}
if (! $uid) {
    loaducenter();
    $username = GameConClient::safeUsername($profile['username'], 15);
    $base = $username;
    for ($i = 2; uc_user_checkname($username) != 1; $i++) {
        $username = substr($base, 0, 13).$i;
    }
    $email = $profile['email'] && uc_user_checkemail($profile['email']) == 1 ? $profile['email'] : GameConClient::placeholderEmail($profile, $_SERVER['HTTP_HOST']);
    $password = GameConClient::random(16);
    $uid = (int) uc_user_register(addslashes($username), $password, $email);
    if ($uid <= 0) {
        showmessage('Не вдалося створити акаунт (код '.$uid.').');
    }
    $groupid = $_G['setting']['newusergroupid'] ? $_G['setting']['newusergroupid'] : 10;
    C::t('common_member')->insert($uid, $username, md5(random(10)), $email, $_G['clientip'], $groupid, ['credits' => explode(',', $_G['setting']['initcredits'])]);
    DB::insert('gamecon_link', ['uid' => $uid, 'gamecon_id' => $profile['id']], false, true);
}

$member = getuserbyuid($uid, 1);
if (! $member) {
    showmessage('Акаунт не знайдено.');
}
setloginstatus($member, 2592000);
C::t('common_member_status')->update($uid, ['lastip' => $_G['clientip'], 'lastvisit' => TIMESTAMP, 'lastactivity' => TIMESTAMP]);
dheader('Location: '.$_G['siteurl']);
