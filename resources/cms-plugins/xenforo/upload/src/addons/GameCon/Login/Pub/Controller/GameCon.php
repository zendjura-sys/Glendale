<?php

namespace GameCon\Login\Pub\Controller;

use XF\Mvc\ParameterBag;
use XF\Pub\Controller\AbstractController;

/**
 * /gamecon/login → GameCon → /gamecon/callback.
 */
class GameCon extends AbstractController
{
    private function client()
    {
        require_once __DIR__.'/../../lib/GameConClient.php';
        $options = \XF::options();

        return new \GameConClient(
            (string) $options->gameconBase,
            (string) $options->gameconClientId,
            (string) $options->gameconClientSecret,
            $this->buildLink('canonical:gamecon/callback'),
            'profile email'
        );
    }

    public function actionLogin(ParameterBag $params)
    {
        $client = $this->client();
        if (! $client->configured()) {
            return $this->error(\XF::phrase('gamecon_not_configured'));
        }
        $auth = $client->authorize();
        $session = $this->session();
        $session->set('gameconState', $auth['state']);
        $session->set('gameconVerifier', $auth['verifier']);
        $session->save();

        return $this->redirect($auth['url'], '');
    }

    public function actionCallback(ParameterBag $params)
    {
        $session = $this->session();
        try {
            $profile = $this->client()->callback($_GET, (string) $session->get('gameconState'), (string) $session->get('gameconVerifier'));
            $user = $this->findOrCreate($profile);
        } catch (\Exception $e) {
            return $this->error($e->getMessage());
        }
        $session->remove('gameconState');
        $session->remove('gameconVerifier');
        /** @var \XF\ControllerPlugin\Login $login */
        $login = $this->plugin('XF:Login');
        $login->completeLogin($user, true);

        return $this->redirect($this->buildLink('index'));
    }

    private function findOrCreate(array $profile)
    {
        $db = \XF::db();
        $userId = (int) $db->fetchOne('SELECT user_id FROM xf_gamecon_link WHERE gamecon_id = ?', $profile['id']);
        if ($userId && ($user = \XF::em()->find('XF:User', $userId))) {
            return $user;
        }
        if ($profile['email'] && $profile['email_verified']) {
            $user = \XF::em()->findOne('XF:User', ['email' => $profile['email']]);
            if ($user) {
                $this->link($user->user_id, $profile['id']);

                return $user;
            }
        }
        $username = \GameConClient::safeUsername($profile['username'], 50);
        $base = $username;
        for ($i = 2; \XF::em()->findOne('XF:User', ['username' => $username]); $i++) {
            $username = $base.$i;
        }
        $email = $profile['email'] && ! \XF::em()->findOne('XF:User', ['email' => $profile['email']])
            ? $profile['email']
            : \GameConClient::placeholderEmail($profile, $this->request()->getHost());

        /** @var \XF\Service\User\Registration $registration */
        $registration = $this->service('XF:User\Registration');
        $registration->setFromInput(['username' => $username, 'email' => $email]);
        $registration->setNoPassword();
        $registration->skipEmailConfirmation();
        if (! $registration->validate($errors)) {
            throw new \RuntimeException(implode(' ', array_map('strval', $errors)));
        }
        $user = $registration->save();
        $this->link($user->user_id, $profile['id']);

        return $user;
    }

    private function link($userId, $gameconId)
    {
        \XF::db()->query('REPLACE INTO xf_gamecon_link (user_id, gamecon_id) VALUES (?, ?)', [$userId, $gameconId]);
    }

    public function assertViewingPermissions($action)
    {
    }

    public function assertNotEmbeddedImageRequest()
    {
    }
}
