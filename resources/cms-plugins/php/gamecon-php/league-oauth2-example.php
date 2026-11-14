<?php
// Symfony / Yii / CodeIgniter / Slim: League OAuth2 Client (composer require league/oauth2-client).
use League\OAuth2\Client\Provider\GenericProvider;

$provider = new GenericProvider([
    'clientId' => getenv('GAMECON_CLIENT_ID'),
    'clientSecret' => getenv('GAMECON_CLIENT_SECRET'),
    'redirectUri' => 'https://ваш-сайт/auth/gamecon/callback',
    'urlAuthorize' => 'https://gamecon.online/oauth/authorize',
    'urlAccessToken' => 'https://gamecon.online/oauth/token',
    'urlResourceOwnerDetails' => 'https://gamecon.online/api/developer/v1/userinfo',
    'scopes' => 'profile email',
    'pkceMethod' => GenericProvider::PKCE_METHOD_S256,
]);

// Старт: збережіть state і PKCE-код у сесії.
// $url = $provider->getAuthorizationUrl(); $_SESSION['state'] = $provider->getState(); $_SESSION['pkce'] = $provider->getPkceCode();
// Повернення: $provider->setPkceCode($_SESSION['pkce']); $token = $provider->getAccessToken('authorization_code', ['code' => $_GET['code']]);
// $owner = $provider->getResourceOwner($token)->toArray(); // sub, preferred_username, name, email, picture
