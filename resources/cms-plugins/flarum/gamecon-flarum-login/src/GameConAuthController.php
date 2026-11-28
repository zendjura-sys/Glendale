<?php

namespace GameCon\FlarumLogin;

use Flarum\Forum\Auth\Registration;
use Flarum\Forum\Auth\ResponseFactory;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * /auth/gamecon — і старт, і повернення (як у вбудованих OAuth Flarum).
 * Нових людей Flarum веде через свою форму реєстрації з підставленими ніком і поштою.
 */
class GameConAuthController implements RequestHandlerInterface
{
    private $response;
    private $settings;
    private $url;

    public function __construct(ResponseFactory $response, SettingsRepositoryInterface $settings, UrlGenerator $url)
    {
        $this->response = $response;
        $this->settings = $settings;
        $this->url = $url;
    }

    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $client = new \GameConClient(
            (string) $this->settings->get('gamecon-login.base_url', 'https://gamecon.online'),
            (string) $this->settings->get('gamecon-login.client_id'),
            (string) $this->settings->get('gamecon-login.client_secret'),
            $this->url->to('forum')->route('auth.gamecon'),
            'profile email'
        );
        $session = $request->getAttribute('session');
        $query = $request->getQueryParams();

        if (empty($query['code']) && empty($query['error'])) {
            $auth = $client->authorize();
            $session->put('gamecon_state', $auth['state']);
            $session->put('gamecon_verifier', $auth['verifier']);

            return new RedirectResponse($auth['url']);
        }

        $profile = $client->callback($query, (string) $session->get('gamecon_state'), (string) $session->get('gamecon_verifier'));
        $session->remove('gamecon_state');
        $session->remove('gamecon_verifier');

        return $this->response->make('gamecon', $profile['id'], function (Registration $registration) use ($profile) {
            if ($profile['email'] && $profile['email_verified']) {
                $registration->provideTrustedEmail($profile['email']);
            } elseif ($profile['email']) {
                $registration->suggestEmail($profile['email']);
            }
            $registration->suggestUsername(\GameConClient::safeUsername($profile['username']));
            if ($profile['avatar']) {
                $registration->provideAvatar($profile['avatar']);
            }
            $registration->setPayload($profile);
        });
    }
}
