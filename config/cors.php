<?php

return [
    // Як у Laravel за замовчуванням + OAuth для GameCon SDK (браузерні й CEF-ігри міняють код на токен напряму).
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'oauth/token', 'oauth/device', 'oauth/revoke'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['*'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
