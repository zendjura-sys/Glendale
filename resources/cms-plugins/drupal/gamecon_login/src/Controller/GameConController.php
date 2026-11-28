<?php

namespace Drupal\gamecon_login\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Routing\TrustedRedirectResponse;
use Drupal\Core\Url;
use Drupal\gamecon_login\GameConLinker;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * /gamecon/login → GameCon → /gamecon/callback.
 */
class GameConController extends ControllerBase {

  private function client(): \GameConClient {
    require_once dirname(__DIR__, 2) . '/lib/GameConClient.php';
    $config = $this->config('gamecon_login.settings');
    return new \GameConClient(
      (string) $config->get('base'),
      (string) $config->get('client_id'),
      (string) $config->get('client_secret'),
      Url::fromRoute('gamecon_login.callback', [], ['absolute' => TRUE])->toString(TRUE)->getGeneratedUrl(),
      $config->get('email') ? 'profile email' : 'profile'
    );
  }

  public function login(Request $request) {
    $client = $this->client();
    if (!$client->configured()) {
      $this->messenger()->addError($this->t('Вхід через GameCon ще не налаштовано.'));
      return new RedirectResponse(Url::fromRoute('user.login')->toString());
    }
    $auth = $client->authorize();
    $session = $request->getSession();
    $session->set('gamecon_state', $auth['state']);
    $session->set('gamecon_verifier', $auth['verifier']);
    $response = new TrustedRedirectResponse($auth['url']);
    $response->getCacheableMetadata()->setCacheMaxAge(0);
    return $response;
  }

  public function callback(Request $request) {
    $session = $request->getSession();
    try {
      $profile = $this->client()->callback($request->query->all(), (string) $session->get('gamecon_state'), (string) $session->get('gamecon_verifier'));
      $user = GameConLinker::findOrCreate($profile);
    }
    catch (\Throwable $e) {
      $this->messenger()->addError($e->getMessage());
      return new RedirectResponse(Url::fromRoute('user.login')->toString());
    }
    $session->remove('gamecon_state');
    $session->remove('gamecon_verifier');
    if ($user->isBlocked()) {
      $this->messenger()->addError($this->t('Цей акаунт заблоковано.'));
      return new RedirectResponse(Url::fromRoute('<front>')->toString());
    }
    user_login_finalize($user);
    return new RedirectResponse(Url::fromRoute('<front>')->toString());
  }

}
