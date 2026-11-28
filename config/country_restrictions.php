<?php

/*
| Обмеження за країнами (Адмінка → Країни → Обмеження): підказки «Рекомендовано».
|
| tags     — ознаки функцій, з якими пов’язані місцеві правила.
| modules  — модуль => ознаки (ключі з config/modules.php).
| plugins  — плагін => ознаки (ключі з config/plugins.php).
| rules    — групи країн і ознаки, які для них варто обмежити. Це лише підказка
|            адміністратору: нічого не застосовується автоматично. Перед застосуванням
|            варто звіритися з актуальними місцевими вимогами.
*/

return [
    'tags' => [
        'payments' => 'Платежі',
        'adult_18' => 'Вміст 18+',
        'gambling_like' => 'Азартні механіки',
        'video_streaming' => 'Відео сторонніх плеєрів',
        'voice_calls' => 'Голосові дзвінки',
        'user_marketplace' => 'Торгівля між людьми',
        'virtual_economy' => 'Віртуальна економіка',
    ],

    'modules' => [
        // +777 — платні номери; дзвінки за номером.
        'phone' => ['voice_calls', 'payments'],
        // Плеєри сторонніх балансерів; у каталозі є фільми з віковим рейтингом 18+.
        'cinema' => ['video_streaming', 'adult_18'],
        // Кліпи з YouTube, Twitch і Medal.
        'moments' => ['video_streaming'],
        // Голосова кімната паті.
        'party' => ['voice_calls'],
        // Банк сім’ї, внески й виплати (ігрова валюта RP-серверів).
        'families' => ['virtual_economy'],
        // Внески клану й голосові кімнати.
        'clans' => ['virtual_economy', 'voice_calls'],
    ],

    'plugins' => [
        'preferred_player' => ['video_streaming'],
        'subtitle_language' => ['video_streaming'],
    ],

    'rules' => [
        [
            'id' => 'card_payments',
            'label' => 'Міжнародні платіжні картки можуть не працювати',
            'countries' => ['BY', 'CU', 'IR', 'KP', 'RU', 'SY'],
            'tags' => ['payments'],
        ],
        [
            'id' => 'video_licensing',
            'label' => 'Суворі вимоги до ліцензування онлайн-відео',
            'countries' => ['CN', 'IR', 'KP', 'SA', 'AE', 'QA', 'KW'],
            'tags' => ['video_streaming'],
        ],
        [
            'id' => 'content_age',
            'label' => 'Суворі правила щодо вмісту 18+',
            'countries' => ['AE', 'SA', 'QA', 'KW', 'IR', 'ID', 'MY', 'PK', 'CN'],
            'tags' => ['adult_18'],
        ],
        [
            'id' => 'voip',
            'label' => 'Обмеження інтернет-дзвінків (VoIP)',
            'countries' => ['AE', 'CN', 'OM', 'KP', 'IR'],
            'tags' => ['voice_calls'],
        ],
        [
            'id' => 'gambling',
            'label' => 'Суворі правила щодо азартних механік',
            'countries' => ['AE', 'SA', 'QA', 'KW', 'CN', 'KR', 'SG'],
            'tags' => ['gambling_like'],
        ],
    ],
];
