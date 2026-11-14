<?php

namespace GameCon\Socialite;

use GuzzleHttp\RequestOptions;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\ProviderInterface;
use Laravel\Socialite\Two\User;

/** Socialite-провайдер «gamecon»: OAuth 2.1 з PKCE, профіль із /api/developer/v1/userinfo. */
class GameConProvider extends AbstractProvider implements ProviderInterface
{
    protected $scopes = ['profile', 'email'];

    protected $scopeSeparator = ' ';

    protected $usesPKCE = true;

    protected function base(): string
    {
        return rtrim((string) ($this->getConfig('base_url') ?: 'https://gamecon.online'), '/');
    }

    public static function additionalConfigKeys(): array
    {
        return ['base_url'];
    }

    protected function getAuthUrl($state): string
    {
        return $this->buildAuthUrlFromBase($this->base().'/oauth/authorize', $state);
    }

    protected function getTokenUrl(): string
    {
        return $this->base().'/oauth/token';
    }

    protected function getUserByToken($token): array
    {
        $response = $this->getHttpClient()->get($this->base().'/api/developer/v1/userinfo', [
            RequestOptions::HEADERS => ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'],
        ]);

        return json_decode((string) $response->getBody(), true);
    }

    protected function mapUserToObject(array $user): User
    {
        return (new User)->setRaw($user)->map([
            'id' => $user['sub'] ?? null,
            'nickname' => $user['preferred_username'] ?? null,
            'name' => $user['name'] ?? null,
            'email' => $user['email'] ?? null,
            'avatar' => $user['picture'] ?? null,
        ]);
    }
}
