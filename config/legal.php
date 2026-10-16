<?php

/*
| Юридичні сторінки (/terms, /privacy, /refund-policy) і реквізити продавця.
|
| Покупці й платіжні сервіси мають бачити, хто надає послугу, і контакт для звернень.
| Заповнюються в Адмінка → Налаштування → «Юридичні дані»; LEGAL_* у .env — запасні значення.
|
| Майстер-версія — українська (вимога ЗУ «Про захист прав споживачів» і «Про забезпечення
| функціонування української мови як державної»); англійська — переклад для іноземних покупців.
| languages — мови документів; файли: resources/views/legal/{document}/{locale}.blade.php.
| Нова мова = новий файл, без змін у коді (контролер сам бачить, які переклади є).
|
| Реквізити ФОП (ЗУ «Про електронну комерцію», ст. 7): ПІБ, РНОКПП, запис ЄДР, адреса, e-mail, телефон.
*/

return [
    'operator' => env('LEGAL_OPERATOR', 'GameCon'),
    'email' => env('LEGAL_EMAIL', 'support@gamecon.online'),
    'address' => env('LEGAL_ADDRESS'),
    'country' => env('LEGAL_COUNTRY', 'Ukraine'),
    'updated' => env('LEGAL_UPDATED', '2026-10-16'),
    'tax_id' => env('LEGAL_TAX_ID'),
    'registry' => env('LEGAL_REGISTRY'),
    'phone' => env('LEGAL_PHONE'),
    'tax_status' => env('LEGAL_TAX_STATUS'),

    'master' => 'uk',
    'languages' => ['uk', 'en'],

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
