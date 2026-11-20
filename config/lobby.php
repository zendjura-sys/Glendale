<?php

/*
 * Категорії живих блоків лобі. Категорія — розділ сайту (модуль або наскрізна річ на кшталт
 * голосових кімнат), підкатегорії — весь функціонал цього розділу. Людина обирає категорії й
 * підкатегорії, блоки з’являються самі, коли там щось відбувається (мітка в куті блоку).
 * 'module' — розділ зникає разом із вимкненим модулем або режимом людини.
 * Підкатегорія — 'ключ' => 'Назва' або ['label' => 'Назва', 'added' => 'YYYY-MM-DD'];
 * 'added' (і в категорії) — 7 днів після дати показується червона бірка «New!».
 */
return [
    'categories' => [
        'messages' => ['label' => 'Повідомлення', 'module' => 'messages', 'subs' => [
            'unread' => ['label' => 'Непрочитані бесіди', 'added' => '2026-11-20'], 'groups' => 'Групи й канали', 'calls' => 'Дзвінки', 'saved' => 'Збережене',
        ]],
        'friends' => ['label' => 'Друзі', 'module' => 'friends', 'subs' => [
            'requests' => 'Заявки', 'contacts' => 'Контакти', 'online' => 'Онлайн', 'suggestions' => 'Можливо, знайомі',
            'birthdays' => 'Дні народження', 'activity' => 'Активність друзів',
        ]],
        'feed' => ['label' => 'Новини', 'module' => 'feed', 'subs' => [
            'compose' => 'Новий допис', 'posts' => 'Стрічка', 'topics' => 'Мої теми', 'while_away' => 'Поки тебе не було',
        ]],
        'profile' => ['label' => 'Моя сторінка', 'module' => 'profile', 'subs' => [
            'visitors' => 'Гості профілю', 'streak' => 'Серія днів', 'badges' => 'Значки й досягнення', 'memories' => 'Спогади',
        ]],
        'phone' => ['label' => 'Телефон', 'module' => 'phone', 'subs' => [
            'missed' => 'Пропущені дзвінки', 'sms' => 'Повідомлення за номером',
        ]],
        'communities' => ['label' => 'Спільноти', 'module' => 'communities', 'subs' => [
            'posts' => 'Нове в моїх спільнотах', 'channels' => 'Канали й голос', 'requests' => 'Заявки на вступ', 'discover' => 'Огляд спільнот',
        ]],
        'photos' => ['label' => 'Фото', 'module' => 'photos', 'subs' => [
            'friends' => 'Нові альбоми друзів', 'mine' => 'Мої альбоми',
        ]],
        'families' => ['label' => 'Сім’я', 'module' => 'families', 'subs' => [
            'shifts' => ['label' => 'Зміни', 'added' => '2026-11-20'], 'events' => 'Події сім’ї', 'reports' => 'Звіти', 'queue' => 'Перевірка звітів',
            'bank' => 'Банк і виплати', 'warehouse' => 'Склад', 'members' => 'Учасники й заявки', 'discipline' => 'Дисципліна',
            'rating' => 'Рейтинг', 'relations' => 'Союзи й війни', 'chat' => 'Чат сім’ї',
        ]],
        'clans' => ['label' => 'Клани й гільдії', 'module' => 'clans', 'subs' => [
            'events' => 'Події', 'shifts' => 'Зміни', 'matches' => 'Матчі', 'news' => 'Новини клану', 'members' => 'Учасники',
        ]],
        'servers' => ['label' => 'Сервери', 'module' => 'servers', 'subs' => [
            'top' => 'Топ за онлайном', 'vote' => 'Голосування дня', 'characters' => 'Мої персонажі', 'mine' => 'Мої сервери',
        ]],
        'music' => ['label' => 'Музика', 'module' => 'music', 'subs' => [
            'player' => ['label' => 'Грає зараз', 'added' => '2026-11-20'], 'new' => 'Нове', 'friends' => 'Що слухають друзі', 'playlists' => 'Плейлисти', 'together' => 'Слухати разом',
        ]],
        'cinema' => ['label' => 'Кіно', 'module' => 'cinema', 'subs' => [
            'continue' => ['label' => 'Продовжити перегляд', 'added' => '2026-11-20'], 'watch' => 'Що подивитися', 'new' => 'Нові серії', 'together' => 'Дивитися разом', 'picks' => 'Добірки',
        ]],
        'games' => ['label' => 'Ігри', 'module' => 'games', 'subs' => [
            'playing' => 'Друзі в грі', 'same' => 'Грають у те саме', 'giveaways' => 'Роздачі й знижки', 'backlog' => 'Мій список', 'cards' => 'Колекційні картки',
        ]],
        'party' => ['label' => 'Пошук паті', 'module' => 'party', 'subs' => [
            'ready' => 'Готові грати', 'board' => 'Дошка паті', 'teammates' => 'Підбір тиммейтів',
        ]],
        'events' => ['label' => 'Події', 'module' => 'events', 'subs' => [
            'soon' => 'Найближчі', 'mine' => 'Мої події', 'tournaments' => 'Турніри',
        ]],
        'quests' => ['label' => 'Завдання й сезон', 'module' => 'quests', 'subs' => [
            'daily' => 'Завдання дня', 'season' => 'Сезонний пропуск', 'rewards' => 'Нагороди',
        ]],
        'moments' => ['label' => 'Моменти', 'module' => 'moments', 'subs' => [
            'stories' => 'Історії друзів', 'clips' => 'Кліпи', 'week' => 'Найкраще за тиждень',
        ]],
        'articles' => ['label' => 'Статті', 'module' => 'articles', 'subs' => [
            'new' => 'Нові статті', 'drafts' => 'Мої чернетки',
        ]],
        'voice' => ['label' => 'Голосові кімнати', 'subs' => [
            'rooms' => 'Кімнати з людьми', 'stage' => 'Сцена',
        ]],
        'live' => ['label' => 'Ефіри', 'subs' => [
            'streams' => 'Стріми друзів', 'livecast' => 'LiveCast', 'gamecast' => 'GameCast',
        ]],
        'alerts' => ['label' => 'Тривоги', 'subs' => [
            'air' => 'Повітряні тривоги',
        ]],
    ],
];
