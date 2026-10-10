<?php

/*
| GameCon+: товари, ціни (для показу на сайті, ₴) і різниця в лімітах.
|
| Справжню ціну списує Lemon Squeezy — товар із тим самим ID варіанта
| (Адмінка → Інтеграції → «Оплата»). Тримайте ціни там і тут однаковими.
|
| kind:  plus — підписка людини, family — підписка сім'ї,
|        gift — разовий подарунок GameCon+ іншій людині, promo — просування сервера.
*/

return [
    'products' => [
        'plus_month' => ['kind' => 'plus', 'name' => 'GameCon+ · місяць', 'price' => 149, 'days' => 30, 'recurring' => true],
        'plus_year' => ['kind' => 'plus', 'name' => 'GameCon+ · рік', 'price' => 1290, 'days' => 365, 'recurring' => true],
        'gift_month' => ['kind' => 'gift', 'name' => 'Подарунок GameCon+ · місяць', 'price' => 149, 'days' => 30, 'recurring' => false],
        'gift_year' => ['kind' => 'gift', 'name' => 'Подарунок GameCon+ · рік', 'price' => 1290, 'days' => 365, 'recurring' => false],
        'family_month' => ['kind' => 'family', 'name' => 'GameCon+ для сім’ї · місяць', 'price' => 399, 'days' => 30, 'recurring' => true],
        'family_year' => ['kind' => 'family', 'name' => 'GameCon+ для сім’ї · рік', 'price' => 3490, 'days' => 365, 'recurring' => true],
        'promo_top_7' => ['kind' => 'promo', 'promo' => 'top', 'name' => 'Місце в топі каталогу · 7 днів', 'price' => 499, 'days' => 7, 'recurring' => false],
        'promo_top_30' => ['kind' => 'promo', 'promo' => 'top', 'name' => 'Місце в топі каталогу · 30 днів', 'price' => 1490, 'days' => 30, 'recurring' => false],
        'promo_highlight_7' => ['kind' => 'promo', 'promo' => 'highlight', 'name' => 'Виділена картка · 7 днів', 'price' => 199, 'days' => 7, 'recurring' => false],
        'promo_highlight_30' => ['kind' => 'promo', 'promo' => 'highlight', 'name' => 'Виділена картка · 30 днів', 'price' => 590, 'days' => 30, 'recurring' => false],
        'promo_banner_30' => ['kind' => 'promo', 'promo' => 'banner', 'name' => 'Банер над каталогом серверів · 30 днів', 'price' => 2490, 'days' => 30, 'recurring' => false],
    ],

    // Скільки серверів одночасно може займати платне місце.
    'promo_slots' => ['top' => 3, 'highlight' => 50, 'banner' => 1],

    // Запас після дати продовження, поки банк проводить платіж.
    'grace_days' => 3,

    // [без GameCon+, з GameCon+]
    'limits' => [
        'characters' => [10, 25],
        'character_photos' => [6, 20],
        'pinned_posts' => [1, 3],
        'party_open' => [3, 5],
        'message_file_mb' => [null, 200],
        'family_voice_rooms' => [10, 20],
    ],

    // Колір ніку: однотонні й градієнти (лише ці значення, жодного довільного CSS).
    'name_colors' => [
        'indigo' => ['#6366f1'],
        'violet' => ['#8b5cf6'],
        'sky' => ['#0ea5e9'],
        'teal' => ['#14b8a6'],
        'emerald' => ['#10b981'],
        'amber' => ['#f59e0b'],
        'rose' => ['#f43f5e'],
        'pink' => ['#ec4899'],
        'aurora' => ['#4f8bff', '#a855f7'],
        'sunset' => ['#f97316', '#ec4899'],
        'ocean' => ['#06b6d4', '#6366f1'],
    ],

    // Рамка аватара. season — колір змінюється щомісяця.
    'frames' => [
        'plus' => ['#6366f1', '#a855f7'],
        'gold' => ['#f59e0b', '#fde68a'],
        'ice' => ['#38bdf8', '#e0f2fe'],
        'ember' => ['#f43f5e', '#f97316'],
        'season' => [],
    ],

    'season_frames' => [
        ['#22d3ee', '#6366f1'], ['#f472b6', '#a855f7'], ['#34d399', '#06b6d4'], ['#fb923c', '#f43f5e'],
        ['#a3e635', '#14b8a6'], ['#facc15', '#f97316'], ['#60a5fa', '#c084fc'], ['#f43f5e', '#8b5cf6'],
        ['#2dd4bf', '#3b82f6'], ['#e879f9', '#f59e0b'], ['#818cf8', '#22d3ee'], ['#fbbf24', '#ef4444'],
    ],

    // Додаткові реакції на записи.
    'reactions' => ['love', 'wow', 'clap', 'skull', 'crown'],
];
