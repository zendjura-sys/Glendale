<?php

/**
 * Vanilla Forums: «Увійти через GameCon» — /entry/gamecon → GameCon → /entry/gamecon/callback.
 */
class GameConPlugin extends Gdn_Plugin
{
    private function client()
    {
        require_once __DIR__.'/lib/GameConClient.php';

        return new GameConClient(
            (string) c('Plugins.GameCon.Base', 'https://gamecon.online'),
            (string) c('Plugins.GameCon.ClientID', ''),
            (string) c('Plugins.GameCon.Secret', ''),
            url('/entry/gamecon/callback', true),
            'profile email'
        );
    }

    /** /entry/gamecon і /entry/gamecon/callback */
    public function entryController_gameCon_create($sender, $args = [])
    {
        $client = $this->client();
        if (! $client->configured()) {
            throw new Gdn_UserException('Вхід через GameCon ще не налаштовано.');
        }
        $session = Gdn::session();
        if (($args[0] ?? '') !== 'callback') {
            $auth = $client->authorize();
            $session->stash('gamecon', ['state' => $auth['state'], 'verifier' => $auth['verifier']]);
            redirectTo($auth['url'], 302, false);
        }
        $flow = $session->stash('gamecon', '', true);
        $profile = $client->callback($_GET, $flow['state'] ?? '', $flow['verifier'] ?? '');
        $userID = Gdn::userModel()->connect($profile['id'], 'gamecon', [
            'Name' => GameConClient::safeUsername($profile['username'], 50),
            'Email' => $profile['email'] ?: GameConClient::placeholderEmail($profile, Gdn::request()->host()),
            'Photo' => $profile['avatar'],
            'Verified' => $profile['email_verified'],
        ], ['CheckCaptcha' => false, 'NoConfirmEmail' => true, 'ValidateEmail' => false]);
        if (! $userID) {
            throw new Gdn_UserException(Gdn::userModel()->Validation->resultsText() ?: 'Не вдалося увійти.');
        }
        Gdn::session()->start($userID, true, true);
        redirectTo('/');
    }

    /** Кнопка на сторінці входу й у віджеті входу. */
    public function base_signInIcons_handler($sender)
    {
        if (c('Plugins.GameCon.ClientID')) {
            echo anchor('<span style="font-weight:600">Увійти через GameCon</span>', '/entry/gamecon', 'Button Primary', ['style' => 'background:#4f46e5;border-color:#4f46e5;color:#fff']);
        }
    }

    public function entryController_signIn_handler($sender)
    {
        if (c('Plugins.GameCon.ClientID')) {
            $sender->Data['Methods'][] = ['Name' => 'GameCon', 'SignInHtml' => anchor('Увійти через GameCon', '/entry/gamecon', 'Button Primary')];
        }
    }

    /** Налаштування: /settings/gamecon */
    public function settingsController_gameCon_create($sender)
    {
        $sender->permission('Garden.Settings.Manage');
        $sender->setData('Title', 'Увійти через GameCon');
        $config = new ConfigurationModule($sender);
        $config->initialize([
            'Plugins.GameCon.ClientID' => ['LabelCode' => 'Client ID', 'Control' => 'TextBox'],
            'Plugins.GameCon.Secret' => ['LabelCode' => 'Client Secret', 'Control' => 'TextBox', 'Options' => ['type' => 'password']],
            'Plugins.GameCon.Base' => ['LabelCode' => 'Адреса GameCon', 'Control' => 'TextBox', 'Default' => 'https://gamecon.online',
                'Description' => 'Адреса повернення для застосунку GameCon: '.url('/entry/gamecon/callback', true)],
        ]);
        $sender->addSideMenu();
        $config->renderAll();
    }
}
