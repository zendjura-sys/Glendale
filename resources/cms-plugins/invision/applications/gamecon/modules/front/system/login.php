<?php

namespace IPS\gamecon\modules\front\system;

if (! \defined('\IPS\SUITE_UNIQUE_KEY')) {
    header(($_SERVER['SERVER_PROTOCOL'] ?? 'HTTP/1.0').' 403 Forbidden');
    exit;
}

/**
 * index.php?app=gamecon&module=system&controller=login → GameCon → &do=callback.
 */
class _login extends \IPS\Dispatcher\Controller
{
    private function client()
    {
        require_once \IPS\ROOT_PATH.'/applications/gamecon/lib/GameConClient.php';

        return new \GameConClient(
            (string) \IPS\Settings::i()->gamecon_base,
            (string) \IPS\Settings::i()->gamecon_client_id,
            (string) \IPS\Settings::i()->gamecon_client_secret,
            (string) \IPS\Http\Url::internal('app=gamecon&module=system&controller=login&do=callback', 'front'),
            'profile email'
        );
    }

    protected function manage()
    {
        $client = $this->client();
        if (! $client->configured()) {
            \IPS\Output::i()->error('Вхід через GameCon ще не налаштовано.', '2GC100/1', 503);
        }
        $auth = $client->authorize();
        $_SESSION['gamecon'] = ['state' => $auth['state'], 'verifier' => $auth['verifier']];
        \IPS\Output::i()->redirect(\IPS\Http\Url::external($auth['url']));
    }

    protected function callback()
    {
        $flow = $_SESSION['gamecon'] ?? [];
        unset($_SESSION['gamecon']);
        try {
            $profile = $this->client()->callback($_GET, $flow['state'] ?? '', $flow['verifier'] ?? '');
            $member = \IPS\gamecon\Link::member($profile);
        } catch (\Exception $e) {
            \IPS\Output::i()->error($e->getMessage(), '2GC100/2', 403);
        }
        if ($member->isBanned()) {
            \IPS\Output::i()->error('Цей акаунт заблоковано.', '2GC100/3', 403);
        }
        \IPS\Session::i()->setMember($member);
        \IPS\Member\Device::loadOrCreate($member, false)->updateAfterAuthentication(true, null);
        \IPS\Output::i()->redirect(\IPS\Http\Url::internal(''));
    }
}
