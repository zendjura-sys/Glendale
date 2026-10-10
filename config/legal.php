<?php

/*
| Юридичні сторінки (/terms, /privacy, /refund-policy) і реквізити продавця.
|
| Paddle перевіряє, що на сайті вказано, хто надає послугу, і є контакт для звернень.
| Заповнюються в Адмінка → Налаштування → «Юридичні дані»; LEGAL_* у .env — запасні значення.
|
| languages — базові мови документів; файли: resources/views/legal/{document}/{locale}.blade.php.
| Нова мова = новий файл, без змін у коді (контролер сам бачить, які переклади є).
*/

return [
    'operator' => env('LEGAL_OPERATOR', 'GameCon'),
    'email' => env('LEGAL_EMAIL', 'support@gamecon.online'),
    'address' => env('LEGAL_ADDRESS'),
    'country' => env('LEGAL_COUNTRY', 'Ukraine'),
    'updated' => env('LEGAL_UPDATED', '2026-10-12'),

    'master' => 'en',
    'languages' => ['en', 'uk', 'de', 'it', 'es', 'zh', 'ja', 'ko'],

    'documents' => [
        'terms' => 'terms',
        'privacy' => 'privacy',
        'refund-policy' => 'refund',
    ],

    // Назви мов у перемикачі (рідною мовою).
    'names' => [
        'en' => 'English', 'uk' => 'Українська', 'de' => 'Deutsch', 'it' => 'Italiano', 'es' => 'Español',
        'zh' => '中文', 'ja' => '日本語', 'ko' => '한국어', 'fr' => 'Français', 'ru' => 'Русский', 'kk' => 'Қазақша',
        'pl' => 'Polski', 'pt' => 'Português', 'tr' => 'Türkçe',
    ],
];
