<?php
/**
 * GameCon OAuth 2.1 — спільний клієнт для плагінів «Увійти через GameCon».
 * Без залежностей: PKCE (S256), state, обмін коду на токен, профіль людини.
 * Документація: https://gamecon.online/developers
 */
if (! class_exists('GameConClient', false)) {
    class GameConClient
    {
        /** @var string */
        private $base;
        /** @var string */
        private $clientId;
        /** @var string */
        private $clientSecret;
        /** @var string */
        private $redirectUri;
        /** @var string */
        private $scope;

        public function __construct($base, $clientId, $clientSecret, $redirectUri, $scope = 'profile email')
        {
            $this->base = rtrim($base !== '' ? $base : 'https://gamecon.online', '/');
            $this->clientId = trim((string) $clientId);
            $this->clientSecret = trim((string) $clientSecret);
            $this->redirectUri = $redirectUri;
            $this->scope = $scope;
        }

        /** Адреса GameCon (для embed.js і посилань). */
        public function base()
        {
            return $this->base;
        }

        public function configured()
        {
            return $this->clientId !== '' && $this->clientSecret !== '';
        }

        public static function random($bytes = 32)
        {
            return self::base64url(random_bytes($bytes));
        }

        public static function base64url($data)
        {
            return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
        }

        /**
         * Посилання на вхід. Збережіть $state і $verifier у сесії до повернення людини.
         *
         * @return array{url: string, state: string, verifier: string}
         */
        public function authorize()
        {
            $state = self::random(24);
            $verifier = self::random(48);
            $query = http_build_query([
                'response_type' => 'code',
                'client_id' => $this->clientId,
                'redirect_uri' => $this->redirectUri,
                'scope' => $this->scope,
                'state' => $state,
                'code_challenge' => self::base64url(hash('sha256', $verifier, true)),
                'code_challenge_method' => 'S256',
            ], '', '&', PHP_QUERY_RFC3986);

            return ['url' => $this->base.'/oauth/authorize?'.$query, 'state' => $state, 'verifier' => $verifier];
        }

        /**
         * Повернення з GameCon: перевіряє state, міняє код на токен і повертає профіль.
         *
         * @param  array<string, mixed>  $query  $_GET
         * @return array{id: string, username: string, name: string, email: ?string, email_verified: bool, avatar: ?string, profile: string}
         */
        public function callback(array $query, $state, $verifier)
        {
            if (isset($query['error'])) {
                throw new RuntimeException(isset($query['error_description']) ? (string) $query['error_description'] : 'Вхід скасовано.');
            }
            if (empty($query['code']) || empty($query['state']) || ! is_string($state) || $state === '' || ! hash_equals($state, (string) $query['state'])) {
                throw new RuntimeException('Сесія входу застаріла — спробуйте ще раз.');
            }
            $token = $this->request('POST', '/oauth/token', [
                'grant_type' => 'authorization_code',
                'code' => (string) $query['code'],
                'redirect_uri' => $this->redirectUri,
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'code_verifier' => (string) $verifier,
            ]);
            if (empty($token['access_token'])) {
                throw new RuntimeException(isset($token['error_description']) ? (string) $token['error_description'] : 'GameCon не видав токен.');
            }
            $user = $this->request('GET', '/api/developer/v1/userinfo', null, (string) $token['access_token']);
            if (empty($user['sub'])) {
                throw new RuntimeException('GameCon не повернув профіль.');
            }

            return [
                'id' => (string) $user['sub'],
                'username' => (string) (isset($user['preferred_username']) ? $user['preferred_username'] : 'gamer'.$user['sub']),
                'name' => (string) (isset($user['name']) ? $user['name'] : ''),
                'email' => isset($user['email']) && is_string($user['email']) ? $user['email'] : null,
                'email_verified' => ! empty($user['email_verified']),
                'avatar' => isset($user['picture']) && is_string($user['picture']) ? $user['picture'] : null,
                'profile' => (string) (isset($user['profile']) ? $user['profile'] : $this->base),
                // Токен дзвіночка для embed.js (лише з правом notifications).
                'bell_token' => isset($user['bell_token']) && is_string($user['bell_token']) ? $user['bell_token'] : null,
            ];
        }

        /**
         * Нік без недозволених символів для рушія (латиниця, цифри, _ і -).
         */
        public static function safeUsername($username, $max = 30)
        {
            $clean = preg_replace('/[^A-Za-z0-9_\-]/', '', (string) $username);

            return substr($clean !== '' ? $clean : 'gamer', 0, $max);
        }

        /** Email-заглушка, якщо людина не дала доступ до пошти (рушії вимагають email). */
        public static function placeholderEmail(array $user, $host)
        {
            return 'gamecon-'.$user['id'].'@'.preg_replace('/^www\./', '', (string) $host);
        }

        /** @return array<string, mixed> */
        private function request($method, $path, $form = null, $bearer = null)
        {
            $headers = ['Accept: application/json', 'User-Agent: GameCon-Login-Plugin/1.0'];
            if ($bearer !== null) {
                $headers[] = 'Authorization: Bearer '.$bearer;
            }
            $body = $form !== null ? http_build_query($form, '', '&') : null;
            if ($body !== null) {
                $headers[] = 'Content-Type: application/x-www-form-urlencoded';
            }
            $url = $this->base.$path;
            if (function_exists('curl_init')) {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 15,
                    CURLOPT_HTTPHEADER => $headers,
                    CURLOPT_CUSTOMREQUEST => $method,
                ]);
                if ($body !== null) {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
                }
                $raw = curl_exec($ch);
                curl_close($ch);
            } else {
                $raw = @file_get_contents($url, false, stream_context_create(['http' => [
                    'method' => $method, 'header' => implode("\r\n", $headers), 'content' => (string) $body, 'timeout' => 15, 'ignore_errors' => true,
                ]]));
            }
            $json = is_string($raw) ? json_decode($raw, true) : null;
            if (! is_array($json)) {
                throw new RuntimeException('GameCon недоступний. Спробуйте пізніше.');
            }

            return $json;
        }
    }
}
