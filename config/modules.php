<?php

/*
| Каталог модулів GameCon.
|
| core      — модуль ядра, не вимикається.
| available — модуль реалізований; недоступні показуються в адмінці як «у розробці».
| default   — стан після першого запуску.
| nav       — пункт лівого меню (route — ім'я маршруту Laravel).
*/

return [
    'profile' => [
        'name' => 'Профілі',
        'description' => 'Сторінки користувачів, обкладинки, аватари, стіна.',
        'icon' => 'user-round',
        'core' => true,
        'available' => true,
        'nav' => ['label' => 'Моя сторінка', 'route' => 'profile.me', 'position' => 10],
    ],
    'feed' => [
        'name' => 'Новини',
        'description' => 'Стрічка записів друзів і рекомендації.',
        'icon' => 'newspaper',
        'core' => true,
        'available' => true,
        'nav' => ['label' => 'Новини', 'route' => 'feed', 'position' => 20],
    ],
    'friends' => [
        'name' => 'Друзі',
        'description' => 'Заявки, список друзів, можливі знайомі.',
        'icon' => 'users-round',
        'core' => true,
        'available' => true,
        'nav' => ['label' => 'Друзі', 'route' => 'friends.index', 'position' => 40],
    ],
    'people' => [
        'name' => 'Пошук людей',
        'description' => 'Глобальний пошук користувачів з фільтрами.',
        'icon' => 'search',
        'core' => false,
        'available' => true,
        'default' => true,
        'nav' => ['label' => 'Пошук людей', 'route' => 'people.index', 'position' => 45],
    ],
    'messages' => [
        'name' => 'Повідомлення',
        'description' => 'Особисті та групові чати в реальному часі.',
        'icon' => 'message-circle',
        'core' => false,
        'available' => true,
        'default' => true,
        'nav' => ['label' => 'Повідомлення', 'route' => 'messages.index', 'position' => 30],
    ],
    'communities' => [
        'name' => 'Спільноти',
        'description' => 'Групи та публічні сторінки з власною стіною й адмінами.',
        'icon' => 'shield',
        'core' => false,
        'available' => true,
        'default' => true,
        'nav' => ['label' => 'Спільноти', 'route' => 'communities.index', 'position' => 50],
    ],
    'photos' => [
        'name' => 'Фото',
        'description' => 'Альбоми користувачів і спільнот, перегляд у лайтбоксі, лайки та коментарі.',
        'icon' => 'image',
        'core' => false,
        'available' => true,
        'default' => true,
        'nav' => ['label' => 'Фотографії', 'route' => 'photos.index', 'position' => 60],
    ],
    'videos' => [
        'name' => 'Відео',
        'description' => 'Завантаження й перегляд відео, плейлисти.',
        'icon' => 'clapperboard',
        'core' => false,
        'available' => false,
        'nav' => ['label' => 'Відео', 'position' => 70],
    ],
    'music' => [
        'name' => 'Музика',
        'description' => 'Аудіозаписи, плейлисти, глобальний плеєр і повна інтеграція зі Spotify.',
        'icon' => 'music',
        'core' => false,
        'available' => true,
        'default' => true,
        'nav' => ['label' => 'Музика', 'route' => 'music.index', 'position' => 80],
    ],
    'cinema' => [
        'name' => 'Кінопортал',
        'description' => 'Фільми, серіали та аніме з плеєрами Kodik, FlixCDN і власними; списки, оцінки, коментарі.',
        'icon' => 'film',
        'core' => false,
        'available' => true,
        'default' => true,
        'nav' => ['label' => 'Кіно', 'route' => 'cinema.index', 'position' => 90],
    ],
    'games' => [
        'name' => 'Ігри',
        'description' => 'Каталог браузерних ігор і рейтинги.',
        'icon' => 'gamepad-2',
        'core' => false,
        'available' => false,
        'nav' => ['label' => 'Ігри', 'position' => 100],
    ],
    'market' => [
        'name' => 'Маркет',
        'description' => 'Оголошення й товари користувачів та спільнот.',
        'icon' => 'shopping-bag',
        'core' => false,
        'available' => false,
        'nav' => ['label' => 'Маркет', 'position' => 110],
    ],
    'events' => [
        'name' => 'Події',
        'description' => 'Зустрічі, турніри, нагадування.',
        'icon' => 'calendar-days',
        'core' => false,
        'available' => false,
        'nav' => ['label' => 'Події', 'position' => 120],
    ],
];
