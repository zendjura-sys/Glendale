<!DOCTYPE html>
@php
    $gcUser = auth()->user();
    $gcTheme = \App\Support\Skins::initialTheme($gcUser);
@endphp
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="{{ $gcTheme === 'dark' ? 'dark' : 'light' }}" data-palette="{{ $gcUser?->palette() ?? 'aurora' }}" data-skin="{{ \App\Support\Skins::for($gcUser) }}" data-theme="{{ $gcTheme }}" data-theme-pref="{{ $gcUser ? \App\Support\Skins::theme($gcUser) : 'guest' }}" style="color-scheme: {{ $gcTheme }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        {{-- Тема до першого кадру: «як на пристрої» і вибір гостя (localStorage) уточнюються тут, тож сторінка не блимає. --}}
        <script>
            (function () {
                var d = document.documentElement, pref = d.dataset.themePref;
                d.classList.add('js');
                if (pref === 'guest') {
                    try { pref = localStorage.getItem('gc-theme') || 'system'; } catch (e) { pref = 'system'; }
                }
                var light = d.dataset.skin === 'gamecon' && (pref === 'light' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches));
                var t = light ? 'light' : 'dark';
                d.dataset.theme = t;
                d.classList.toggle('dark', !light);
                d.classList.toggle('light', light);
                d.style.colorScheme = t;
                document.addEventListener('DOMContentLoaded', function () {
                    var m = document.querySelector('meta[name=theme-color]');
                    if (m) m.content = light ? '#e9f1f8' : '#05070f';
                });
            })();
        </script>
        <meta name="theme-color" content="#05070f">
        <meta name="color-scheme" content="dark light">

        @php
            $seo = app(\App\Support\Settings\SiteSettings::class);
            $seoName = $seo->get('site_name') ?: config('app.name', 'GameCon');
            $seoDescription = $seo->seoDescription();
            $seoUrl = request()->url();
            $seoImage = url('/og.jpg');
        @endphp

        <meta name="description" content="{{ $seoDescription }}">
        <meta name="application-name" content="{{ $seoName }}">
        <link rel="canonical" href="{{ $seoUrl }}">

        <meta property="og:site_name" content="{{ $seoName }}">
        <meta property="og:title" content="{{ $seoName }}">
        <meta property="og:description" content="{{ $seoDescription }}">
        <meta property="og:type" content="website">
        <meta property="og:url" content="{{ $seoUrl }}">
        <meta property="og:image" content="{{ $seoImage }}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:image:alt" content="{{ $seoDescription }}">
        <meta property="og:locale" content="uk_UA">

        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="{{ $seoName }}">
        <meta name="twitter:description" content="{{ $seoDescription }}">
        <meta name="twitter:image" content="{{ $seoImage }}">
        <meta name="twitter:image:alt" content="{{ $seoName }}">

        @php
            // Хто стоїть за сайтом (Organization) — для пошуковиків: логотип, контакт підтримки, офіційні сторінки.
            $seoEmail = trim((string) ($seo->get('legal_email') ?: config('legal.email')));
            $seoGraph = [
                [
                    '@type' => 'WebSite',
                    '@id' => url('/').'#website',
                    'name' => $seoName,
                    'description' => $seoDescription,
                    'url' => url('/'),
                    'inLanguage' => 'uk-UA',
                    'publisher' => ['@id' => url('/').'#organization'],
                ],
                array_filter([
                    '@type' => 'Organization',
                    '@id' => url('/').'#organization',
                    'name' => $seoName,
                    'url' => url('/'),
                    'logo' => url('/apple-touch-icon.png'),
                    'image' => $seoImage,
                    'email' => $seoEmail !== '' ? $seoEmail : null,
                    'sameAs' => $seo->seoSameAs() ?: null,
                    'contactPoint' => $seoEmail !== '' ? [[
                        '@type' => 'ContactPoint',
                        'contactType' => 'customer support',
                        'email' => $seoEmail,
                        'url' => url('/contacts'),
                        'availableLanguage' => ['uk', 'en'],
                    ]] : null,
                ]),
            ];
        @endphp
        <script type="application/ld+json">
            {!! json_encode([
                '@@context' => 'https://schema.org',
                '@graph' => $seoGraph,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) !!}
        </script>

        <style>
            html { background-color: #05070f; }
            html[data-theme='light'] { background-color: #e9f1f8; }
            /* Текст головної для пошуковиків і браузерів без JavaScript; з JavaScript його замінює сайт. */
            html.js .seo-static { display: none; }
        </style>

        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/site.webmanifest">


        {{-- Розмір тексту пристрою (lib/device-prefs.ts) — до першого кадру, щоб сторінка не «стрибала». --}}
        <script>try{var t=localStorage.getItem('gc.text-size');if(t==='s'||t==='l'||t==='xl')document.documentElement.dataset.text=t}catch(e){}</script>
        @php
            $locale = app()->getLocale();
        @endphp
        @if ($locale === 'uk')
            <script>window.__I18N__={locale:'uk',dict:{}};</script>
        @else
            <script src="{{ url('/i18n/'.$locale.'.js') }}?v={{ app(\App\Support\I18n\Translations::class)->version($locale) }}"></script>
        @endif
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        {{-- Стиль сайту з Адмінка → Дизайн: після app.css, щоб перевизначати змінні теми. --}}
        @php
            $designTheme = app(\App\Services\Design\SiteThemes::class)->urlFor(request());
        @endphp
        @if ($designTheme)
            <link rel="stylesheet" href="{{ $designTheme }}" data-site-theme>
        @endif
        <x-inertia::head>
            <title>{{ config('app.name', 'GameCon') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
        @if (($page['component'] ?? null) === 'welcome')
            @include('seo.home', ['name' => $seoName, 'description' => $seoDescription, 'email' => $seoEmail])
        @endif
    </body>
</html>
