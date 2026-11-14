<?php

namespace GameCon\Plugin\System\GameCon\Extension;

\defined('_JEXEC') or die;

use Joomla\CMS\Authentication\Authentication;
use Joomla\CMS\Component\ComponentHelper;
use Joomla\CMS\Factory;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Plugin\CMSPlugin;
use Joomla\CMS\Plugin\PluginHelper;
use Joomla\CMS\Uri\Uri;
use Joomla\CMS\User\User;
use Joomla\CMS\User\UserHelper;
use Joomla\Event\SubscriberInterface;

/**
 * «Увійти через GameCon»: ?gamecon=login → GameCon → ?gamecon=callback.
 * Зв’язок акаунтів — у #__user_profiles (profile_key = gamecon.id).
 */
final class GameCon extends CMSPlugin implements SubscriberInterface
{
    protected $autoloadLanguage = true;

    public static function getSubscribedEvents(): array
    {
        return ['onAfterRoute' => 'onAfterRoute', 'onAfterRender' => 'onAfterRender'];
    }

    private function client(): \GameConClient
    {
        require_once \dirname(__DIR__, 2).'/lib/GameConClient.php';

        return new \GameConClient(
            (string) $this->params->get('base', 'https://gamecon.online'),
            (string) $this->params->get('client_id', ''),
            (string) $this->params->get('client_secret', ''),
            Uri::root().'index.php?gamecon=callback',
            $this->params->get('email', 1) ? 'profile email' : 'profile'
        );
    }

    public function onAfterRoute(): void
    {
        $app = $this->getApplication();
        if (! $app->isClient('site')) {
            return;
        }
        $action = $app->getInput()->getCmd('gamecon');
        if ($action === '') {
            return;
        }
        $client = $this->client();
        $session = $app->getSession();
        if (! $client->configured()) {
            $app->enqueueMessage(Text::_('PLG_SYSTEM_GAMECON_NOT_CONFIGURED'), 'warning');
            $app->redirect(Uri::root());
        }
        if ($action === 'login') {
            $auth = $client->authorize();
            $session->set('gamecon.state', $auth['state']);
            $session->set('gamecon.verifier', $auth['verifier']);
            $session->set('gamecon.back', base64_decode((string) $app->getInput()->getBase64('return', '')) ?: Uri::root());
            $app->redirect($auth['url']);
        }
        if ($action === 'callback') {
            $back = (string) $session->get('gamecon.back', Uri::root());
            try {
                $profile = $client->callback($_GET, (string) $session->get('gamecon.state', ''), (string) $session->get('gamecon.verifier', ''));
                $user = $this->findOrCreate($profile);
            } catch (\Throwable $e) {
                $app->enqueueMessage($e->getMessage(), 'error');
                $app->redirect(Uri::root());
            }
            $session->clear('gamecon.state');
            $session->clear('gamecon.verifier');
            // Стандартний вхід Joomla: плагін «Користувач — Joomla» кладе людину в сесію.
            PluginHelper::importPlugin('user');
            $app->triggerEvent('onUserLogin', [[
                'username' => $user->username,
                'email' => $user->email,
                'fullname' => $user->name,
                'password_clear' => '',
                'status' => Authentication::STATUS_SUCCESS,
                'type' => 'GameCon',
            ], ['remember' => true, 'action' => 'core.login.site']]);
            $app->redirect(Uri::isInternal($back) ? $back : Uri::root());
        }
    }

    private function findOrCreate(array $profile): User
    {
        $db = Factory::getContainer()->get('DatabaseDriver');
        $query = $db->getQuery(true)->select($db->quoteName('user_id'))->from($db->quoteName('#__user_profiles'))
            ->where($db->quoteName('profile_key').' = '.$db->quote('gamecon.id'))
            ->where($db->quoteName('profile_value').' = '.$db->quote(json_encode($profile['id'])));
        $id = (int) $db->setQuery($query)->loadResult();
        if (! $id && $profile['email'] && $profile['email_verified']) {
            $id = (int) $db->setQuery($db->getQuery(true)->select('id')->from('#__users')->where('email = '.$db->quote($profile['email'])))->loadResult();
            if ($id) {
                $this->link($id, $profile['id']);
            }
        }
        if ($id) {
            return User::getInstance($id);
        }
        $username = \GameConClient::safeUsername($profile['username'], 150);
        $base = $username;
        for ($i = 2; UserHelper::getUserId($username); $i++) {
            $username = $base.$i;
        }
        $email = $profile['email'];
        if (! $email || $db->setQuery($db->getQuery(true)->select('id')->from('#__users')->where('email = '.$db->quote($email)))->loadResult()) {
            $email = \GameConClient::placeholderEmail($profile, Uri::getInstance()->getHost());
        }
        $user = new User();
        $user->bind([
            'name' => $profile['name'] !== '' ? $profile['name'] : $username,
            'username' => $username,
            'email' => $email,
            'password' => UserHelper::genRandomPassword(32),
            'groups' => [(int) ComponentHelper::getParams('com_users')->get('new_usertype', 2)],
            'block' => 0,
        ]);
        if (! $user->save()) {
            throw new \RuntimeException($user->getError() ?: 'Не вдалося створити акаунт.');
        }
        $this->link((int) $user->id, $profile['id']);

        return $user;
    }

    private function link(int $userId, string $gameconId): void
    {
        $db = Factory::getContainer()->get('DatabaseDriver');
        $db->setQuery($db->getQuery(true)->delete('#__user_profiles')->where('user_id = '.$userId)->where($db->quoteName('profile_key').' = '.$db->quote('gamecon.id')))->execute();
        $row = (object) ['user_id' => $userId, 'profile_key' => 'gamecon.id', 'profile_value' => json_encode($gameconId), 'ordering' => 0];
        $db->insertObject('#__user_profiles', $row);
    }

    /** Кнопка у формах входу (сторінка входу й модуль входу). */
    public function onAfterRender(): void
    {
        $app = $this->getApplication();
        if (! $app->isClient('site') || ! $app->getIdentity()->guest || ! $this->client()->configured()) {
            return;
        }
        $body = $app->getBody();
        if (strpos($body, 'com-users-login__form') === false && strpos($body, 'mod-login') === false) {
            return;
        }
        $url = Uri::root().'index.php?gamecon=login&return='.base64_encode(Uri::getInstance()->toString());
        $button = '<p class="gamecon-login"><a class="btn btn-primary w-100" style="background:#4f46e5;border-color:#4f46e5" href="'.htmlspecialchars($url, ENT_QUOTES).'">'
            .Text::_('PLG_SYSTEM_GAMECON_BUTTON').'</a></p>';
        $body = preg_replace('#(<form[^>]+(?:com-users-login__form|mod-login)[^>]*>)#', '$1'.$button, $body, 1);
        $app->setBody($body);
    }
}
