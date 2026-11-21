<?php

/**
 * InstantCMS 2: «Увійти через GameCon» — /gamecon/login → GameCon → /gamecon/callback.
 */
class gamecon extends cmsFrontend
{
    protected $useOptions = true;

    private function client()
    {
        require_once __DIR__.'/lib/GameConClient.php';

        return new GameConClient(
            (string) $this->options['base'],
            (string) $this->options['client_id'],
            (string) $this->options['client_secret'],
            href_to_abs('gamecon', 'callback'),
            'profile email'
        );
    }

    public function actionLogin()
    {
        $client = $this->client();
        if (! $client->configured()) {
            cmsCore::error404();
        }
        $auth = $client->authorize();
        cmsUser::sessionSet('gamecon_state', $auth['state']);
        cmsUser::sessionSet('gamecon_verifier', $auth['verifier']);
        $this->redirect($auth['url']);
    }

    public function actionCallback()
    {
        try {
            $profile = $this->client()->callback($_GET, (string) cmsUser::sessionGet('gamecon_state'), (string) cmsUser::sessionGet('gamecon_verifier'));
        } catch (Exception $e) {
            cmsUser::addSessionMessage(htmlspecialchars($e->getMessage()), 'error');
            $this->redirectToHome();
        }
        cmsUser::sessionUnset('gamecon_state');
        cmsUser::sessionUnset('gamecon_verifier');

        $users = cmsCore::getModel('users');
        $link = $this->model->getItemByField('gamecon_links', 'gamecon_id', $profile['id']);
        $user = $link ? $users->getUser($link['user_id']) : false;
        if (! $user && $profile['email'] && $profile['email_verified']) {
            $user = $users->getUserByEmail($profile['email']);
        }
        if (! $user) {
            $password = GameConClient::random(16);
            $result = $users->addUser([
                'email' => $profile['email'] && ! $users->getUserByEmail($profile['email']) ? $profile['email'] : GameConClient::placeholderEmail($profile, $_SERVER['HTTP_HOST']),
                'nickname' => $profile['name'] !== '' ? $profile['name'] : $profile['username'],
                'password1' => $password,
                'password2' => $password,
                'groups' => [cmsUser::DEFAULT_GROUP_ID],
            ]);
            if (empty($result['success'])) {
                cmsUser::addSessionMessage('Не вдалося створити акаунт.', 'error');
                $this->redirectToHome();
            }
            $user = $users->getUser($result['id']);
        }
        $this->model->deleteFiltered('gamecon_links', ['user_id' => $user['id']]);
        $this->model->insert('gamecon_links', ['user_id' => $user['id'], 'gamecon_id' => $profile['id']]);
        cmsUser::loginComplete($user, true);
        $this->redirectToHome();
    }

    /** Кнопка: {$gamecon_button} у шаблоні або хук у формі входу. */
    public static function button()
    {
        return '<a class="btn btn-primary" style="background:#4f46e5;border-color:#4f46e5" href="'.href_to('gamecon', 'login').'">Увійти через GameCon</a>';
    }
}
