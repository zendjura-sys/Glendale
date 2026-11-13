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
            // Сторінка може задати свою назву й опис (withViewData: seoTitle, seoDescription) — напр. довідка.
            $seoDescription = isset($seoDescription) && $seoDescription !== '' ? (string) $seoDescription : $seo->seoDescription();
            $seoPageTitle = isset($seoTitle) && $seoTitle !== '' ? $seoTitle.' · '.$seoName : $seoName;
            $seoUrl = request()->url();
            // Сторінка може задати свою картинку й тип (seoImage, seoType) — напр. обкладинка гри.
            $seoImage = isset($seoImage) && is_string($seoImage) && $seoImage !== '' ? $seoImage : url('/og.jpg');
            $seoType = isset($seoType) && is_string($seoType) && $seoType !== '' ? $seoType : 'website';
        @endphp

        <meta name="description" content="{{ $seoDescription }}">
        <meta name="application-name" content="{{ $seoName }}">
        <link rel="canonical" href="{{ $seoUrl }}">

        <meta property="og:site_name" content="{{ $seoName }}">
        <meta property="og:title" content="{{ $seoPageTitle }}">
        <meta property="og:description" content="{{ $seoDescription }}">
        <meta property="og:type" content="{{ $seoType }}">
        <meta property="og:url" content="{{ $seoUrl }}">
        <meta property="og:image" content="{{ $seoImage }}">
        @if ($seoImage === url('/og.jpg') || ! empty($seoImageSize))
            <meta property="og:image:width" content="1200">
            <meta property="og:image:height" content="630">
        @endif
        <meta property="og:image:alt" content="{{ $seoDescription }}">
        <meta property="og:locale" content="uk_UA">

        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="{{ $seoPageTitle }}">
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
            // Розмітка самої сторінки (seoEntity): гра, профіль тощо.
            if (isset($seoEntity) && is_array($seoEntity) && $seoEntity !== []) {
                $seoGraph[] = $seoEntity;
            }
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
            <title>{{ isset($seoTitle) && $seoTitle !== '' ? $seoPageTitle : config('app.name', 'GameCon') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        {{-- Перший екран до завантаження JS/CSS: інлайн-стилі, щоб показатися миттєво. Ховає app.tsx після першого рендеру. --}}
        <noscript><style>#gc-splash-loader{display:none!important}</style></noscript>
        <div id="gc-splash-loader" role="status" aria-live="polite" style="position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#04070D;transition:opacity .35s cubic-bezier(.22,1,.36,1),visibility .35s">
            <style>
                @keyframes gcSplashPulse{0%,100%{transform:scale(.98)}50%{transform:scale(1.02)}}
                @keyframes gcSplashBeam{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
                #gc-splash-loader .gc-sq{width:88px;height:88px;border-radius:24px;padding:2px;background:linear-gradient(45deg,#1D4ED8,#00D2FF);box-shadow:0 0 35px rgba(0,210,255,.28);animation:gcSplashPulse 2s ease-in-out infinite}
                #gc-splash-loader .gc-sq>div{width:100%;height:100%;border-radius:22px;background:#070D19;box-shadow:inset 0 0 18px rgba(0,210,255,.15);display:flex;align-items:center;justify-content:center}
                #gc-splash-loader img{width:58px;height:58px;filter:drop-shadow(0 0 12px rgba(0,210,255,.6))}
                #gc-splash-loader .gc-bar{width:140px;height:3px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;margin-top:24px}
                #gc-splash-loader .gc-bar>i{display:block;width:100%;height:100%;background:linear-gradient(90deg,transparent,#2563EB,#00D2FF,transparent);animation:gcSplashBeam 1.1s ease-in-out infinite}
                #gc-splash-loader .gc-st{font:500 12px/1.4 Montserrat,system-ui,sans-serif;color:#94A3B8;letter-spacing:.04em;margin-top:10px;min-height:17px}
                @media (prefers-reduced-motion:reduce){#gc-splash-loader .gc-sq,#gc-splash-loader .gc-bar>i{animation:none}}
            </style>
            <div class="gc-sq"><div><img src="/images/brand/logo-mark.png" alt="GameCon" width="58" height="58" onerror="this.outerHTML='<svg width=&quot;52&quot; height=&quot;52&quot; viewBox=&quot;0 0 52 52&quot;><defs><linearGradient id=&quot;gcG&quot; x1=&quot;0&quot; y1=&quot;1&quot; x2=&quot;1&quot; y2=&quot;0&quot;><stop offset=&quot;0&quot; stop-color=&quot;#2563EB&quot;/><stop offset=&quot;1&quot; stop-color=&quot;#00D2FF&quot;/></linearGradient></defs><path d=&quot;M40 14a17 17 0 1 0 2 20H27&quot; fill=&quot;none&quot; stroke=&quot;url(#gcG)&quot; stroke-width=&quot;5&quot; stroke-linecap=&quot;round&quot;/></svg>'"></div></div>
            <div class="gc-bar"><i></i></div>
            <div class="gc-st" id="gc-splash-status">Ініціалізація GameCon OS...</div>
            <script>
                (function () {
                    var lines = ['Ініціалізація GameCon OS...', 'Синхронізація ігрового профілю...', 'Підключення до серверів та штабу...'];
                    var i = 0, el = document.getElementById('gc-splash-status');
                    var timer = setInterval(function () { i = (i + 1) % lines.length; if (el) el.textContent = lines[i]; }, 900);
                    window.gcHideSplash = function () {
                        var s = document.getElementById('gc-splash-loader');
                        if (!s) return;
                        clearInterval(timer);
                        s.style.opacity = '0'; s.style.pointerEvents = 'none'; s.style.visibility = 'hidden';
                        setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 350);
                    };
                    // Страховка: навіть на повільній мережі сплеш зникне за 2,5 с після завантаження сторінки.
                    window.addEventListener('load', function () { setTimeout(window.gcHideSplash, 2500); });
                })();
            </script>
        </div>
        <x-inertia::app />
        @if (($page['component'] ?? null) === 'welcome')
            @include('seo.home', ['name' => $seoName, 'description' => $seoDescription, 'email' => $seoEmail])
        @endif
    </body>
</html>
