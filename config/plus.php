<?php

/*
| GameCon+: товари, ціни (₴) і різниця в лімітах.
|
| На сайті оплата — передплата періоду через донат-сервіси (Адмінка → GameCon+ → «Способи оплати»):
| людина отримує код замовлення, вказує його в повідомленні до донату, і замовлення
| зараховується автоматично (Donatello) або після перевірки адміністратором. Автопродовження немає.
| У застосунку — Google Play Billing (там підписка продовжується, доки її не скасують у Google Play).
|
| kind:  plus — GameCon+ людини, family — GameCon+ сім'ї,
|        gift — подарунок GameCon+ іншій людині, promo — просування сервера.
*/

return [
    'products' => [
        'plus_month' => ['kind' => 'plus', 'name' => 'GameCon+ · місяць', 'price' => 149, 'days' => 30, 'recurring' => false],
        'plus_year' => ['kind' => 'plus', 'name' => 'GameCon+ · рік', 'price' => 1290, 'days' => 365, 'recurring' => false],
        'gift_month' => ['kind' => 'gift', 'name' => 'Подарунок GameCon+ · місяць', 'price' => 149, 'days' => 30, 'recurring' => false],
        'gift_year' => ['kind' => 'gift', 'name' => 'Подарунок GameCon+ · рік', 'price' => 1290, 'days' => 365, 'recurring' => false],
        'family_month' => ['kind' => 'family', 'name' => 'GameCon+ для сім’ї · місяць', 'price' => 399, 'days' => 30, 'recurring' => false],
        'family_year' => ['kind' => 'family', 'name' => 'GameCon+ для сім’ї · рік', 'price' => 3490, 'days' => 365, 'recurring' => false],
        'promo_top_7' => ['kind' => 'promo', 'promo' => 'top', 'name' => 'Місце в топі каталогу · 7 днів', 'price' => 499, 'days' => 7, 'recurring' => false],
        'promo_top_30' => ['kind' => 'promo', 'promo' => 'top', 'name' => 'Місце в топі каталогу · 30 днів', 'price' => 1490, 'days' => 30, 'recurring' => false],
        'promo_highlight_7' => ['kind' => 'promo', 'promo' => 'highlight', 'name' => 'Виділена картка · 7 днів', 'price' => 199, 'days' => 7, 'recurring' => false],
        'promo_highlight_30' => ['kind' => 'promo', 'promo' => 'highlight', 'name' => 'Виділена картка · 30 днів', 'price' => 590, 'days' => 30, 'recurring' => false],
        'promo_banner_30' => ['kind' => 'promo', 'promo' => 'banner', 'name' => 'Банер над каталогом серверів · 30 днів', 'price' => 2490, 'days' => 30, 'recurring' => false],
        // Внутрішні номери +777 (App\Services\Phones): ціна за рівнем номера, з GameCon+ — знижка (Адмінка → Номери).
        'phone_regular' => ['kind' => 'phone', 'name' => 'Номер +777 · звичайний', 'price' => 19, 'days' => 0, 'recurring' => false],
        'phone_bronze' => ['kind' => 'phone', 'name' => 'Номер +777 · бронзовий', 'price' => 49, 'days' => 0, 'recurring' => false],
        'phone_silver' => ['kind' => 'phone', 'name' => 'Номер +777 · срібний', 'price' => 99, 'days' => 0, 'recurring' => false],
        'phone_gold' => ['kind' => 'phone', 'name' => 'Номер +777 · золотий', 'price' => 199, 'days' => 0, 'recurring' => false],
        'phone_platinum' => ['kind' => 'phone', 'name' => 'Номер +777 · платиновий', 'price' => 499, 'days' => 0, 'recurring' => false],
        'phone_diamond' => ['kind' => 'phone', 'name' => 'Номер +777 · діамантовий', 'price' => 999, 'days' => 0, 'recurring' => false],
    ],

    // Скільки серверів одночасно може займати платне місце.
    'promo_slots' => ['top' => 3, 'highlight' => 50, 'banner' => 1],

    // Запас після дати продовження підписки Google Play, поки банк проводить платіж.
    'grace_days' => 3,

    // Скільки годин чекає неоплачене замовлення.
    'order_hours' => 72,

    // Способи оплати. auto — сервер сам знаходить донат за кодом у повідомленні (через API сервісу);
    // інші підтверджує адміністратор. Посилання й увімкнення — в адмінці (setting plus_methods).
    'methods' => [
        'donatello' => ['label' => 'Donatello', 'auto' => true, 'currency' => 'UAH', 'placeholder' => 'https://donatello.to/…'],
        'diaka' => ['label' => 'Diaka', 'auto' => false, 'currency' => 'UAH', 'placeholder' => 'https://diaka.ua/…'],
        'donatik' => ['label' => 'Donatik', 'auto' => false, 'currency' => 'UAH', 'placeholder' => 'https://donatik.ua/…'],
        'bmc' => ['label' => 'Buy Me a Coffee', 'auto' => false, 'currency' => 'USD', 'placeholder' => 'https://buymeacoffee.com/…'],
        'patreon' => ['label' => 'Patreon', 'auto' => false, 'currency' => 'USD', 'placeholder' => 'https://patreon.com/…'],
        'other' => ['label' => 'Інший спосіб', 'auto' => false, 'currency' => 'UAH', 'placeholder' => 'https://…'],
    ],

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

    // Анімація ніку (вимикається при «зменшити рух»): flow — кольори течуть по імені, shine — відблиск,
    // neon — м’яке пульсуюче світіння, rainbow — плавна зміна відтінку.
    'name_effects' => ['flow', 'shine', 'neon', 'rainbow'],

    // Ефект шапки профілю в кольорах сторінки: aurora — повільне сяйво внизу обкладинки, rim — жива рамка шапки.
    'header_effects' => ['aurora', 'rim'],

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
