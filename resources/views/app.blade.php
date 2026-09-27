<!DOCTYPE html>
@php
    // Оформление читается из настроек (админка → Дизайн), а не собирается
    // в бандл: смена акцента или фавикона не должна требовать пересборки
    // фронтенда и деплоя.
    $design = App\Support\DesignSettings::all();
    $accentCss = App\Support\DesignSettings::accentCss();

    // Прев'ю посилання (Telegram, Discord тощо) читають <title> і
    // meta description САМЕ на момент завантаження — це та сама сторінка
    // на тому ж домені, лише інший заголовок/опис. Без цієї гілки
    // union.gamecon.online у прев'ю показував текст головного сайту, бо тег
    // був один статичний на весь застосунок.
    $isUnionPage = App\Support\UnionDomain::matches(request());
    $pageTitle = $isUnionPage ? App\Support\DesignSettings::unionTitle() : ($design['siteName'] ?: config('app.name', 'Laravel'));
    $pageDescription = $isUnionPage
        ? (App\Support\FamilyContent::unionAbout()[0] ?? 'Союз Monsory — окремий вхід для родин-партнерів.')
        : (App\Support\FamilyContent::about()[0] ?? 'Monsory Family — закрита родина на RP-сервері.');
    $ogImage = $design['logoUrl'] ?: asset('images/icons/icon-512.png');
@endphp
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" data-effects="{{ $design['effects'] }}" data-season="{{ $design['seasonalTheme'] }}">
    <head>
        <meta charset="utf-8">
        {{-- viewport-fit=cover — иначе на телефонах с вырезом (iPhone X и
             новее) контент не доходит до краёв экрана и по бокам остаются
             чёрные поля вместо полноэкранной сцены. --}}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        {{-- Красит адресную строку браузера на телефоне в цвет фона сайта:
             без этого поверх тёмной страницы висит светлая полоса. --}}
        <meta name="theme-color" content="#060605">

        @if ($design['faviconUrl'])
            <link rel="icon" href="{{ $design['faviconUrl'] }}">
        @endif

        {{-- PWA: «Додати на головний екран» на телефоні. Іконки — статичні
             файли (фірмовий ромб з M), а не той самий faviconUrl вище: той
             admin-редагований і може бути відсутній, а маніфест без хоч
             одної валідної іконки браузер просто ігнорує — install prompt
             не з'явиться взагалі. --}}
        <link rel="manifest" href="/manifest.webmanifest">
        <link rel="apple-touch-icon" href="/images/icons/apple-touch-icon.png">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="GameCon">
        <meta name="mobile-web-app-capable" content="yes">

        <meta name="description" content="{{ $pageDescription }}">

        {{-- Open Graph/Twitter — без них прев'ю посилання (Telegram, Discord)
             підхоплює перший-ліпший <img> зі сторінки замість логотипу, а
             деякі клієнти взагалі ігнорують <meta name="description">. --}}
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="{{ $design['siteName'] ?: 'GameConnect' }}">
        <meta property="og:url" content="{{ request()->url() }}">
        <meta property="og:title" content="{{ $pageTitle }}">
        <meta property="og:description" content="{{ $pageDescription }}">
        <meta property="og:image" content="{{ $ogImage }}">
        <meta name="twitter:card" content="summary_large_image">

        <title inertia>{{ $pageTitle }}</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net" crossorigin>
        {{-- figtree убран: в теме он нигде не используется (sans — Manrope,
             display — Montserrat), но три его начертания всё равно грузились
             на каждой странице. Montserrat сюда не входит — он самостоятельно
             хостится из public/fonts (см. app.css), а не тянется с bunny.net. --}}
        <link href="https://fonts.bunny.net/css?family=manrope:400,500,600,700&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @routes
        @vite(['resources/js/app.js', "resources/js/Pages/{$page['component']}.vue"])

        @if ($accentCss)
            {{-- Пять переменных перекрашивают весь сайт: палитра золота в
                 Tailwind объявлена как rgb(var(--gold-N)).

                 Обязательно ПОСЛЕ @vite: дефолты живут в :root внутри
                 app.css, селектор тот же, и при равной специфичности
                 побеждает тот, что идёт в документе последним. Стоя выше,
                 переопределение молча не работало. --}}
            <style>:root{ {!! $accentCss !!} }</style>
        @endif
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
