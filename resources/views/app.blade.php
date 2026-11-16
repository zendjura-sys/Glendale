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
                    if (m) m.content = light ? '#F2F4F8' : '#07090E';
                });
            })();
        </script>
        <meta name="theme-color" content="#07090E">
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
            html { background-color: #07090E; }
            html[data-theme='light'] { background-color: #F2F4F8; }
            html, body { transition: background-color .45s cubic-bezier(.22,1,.36,1), color .45s cubic-bezier(.22,1,.36,1); }
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
        {{-- Сплеш лише при першому відкритті сайту за сесію браузера; далі переходи безшовні (SPA). --}}
        <script>try { if (sessionStorage.getItem('gc_splash_seen')) document.documentElement.classList.add('gc-splash-skip'); } catch (e) {}</script>
        <div id="gc-splash-loader" role="status" aria-live="polite">
            <style>
                #gc-splash-loader{--sp-bg:#07090E;--sp-tile:rgba(255,255,255,.06);--sp-text:rgba(248,250,252,.72);--sp-track:rgba(255,255,255,.10);position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,12,16,.90);-webkit-backdrop-filter:blur(48px) saturate(140%);backdrop-filter:blur(48px) saturate(140%);transition:opacity .42s cubic-bezier(.22,1,.36,1),transform .42s cubic-bezier(.22,1,.36,1),visibility .42s}
                html[data-theme='light'] #gc-splash-loader{--sp-bg:#F2F4F8;--sp-tile:rgba(255,255,255,.82);--sp-text:#64748B;--sp-track:rgba(15,23,42,.08);background:rgba(242,244,248,.92)}
                html.gc-splash-skip #gc-splash-loader{display:none}
                @keyframes gcSplashBeam{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
                @keyframes gcSplashDraw{to{stroke-dashoffset:0}}
                #gc-splash-loader .gc-sq{width:96px;height:96px;border-radius:28px;border:1px solid rgba(255,255,255,.16);background:var(--sp-tile);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 14px 36px -6px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}
                html[data-theme='light'] #gc-splash-loader .gc-sq{border-color:rgba(15,23,42,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 14px 36px -6px rgba(15,23,42,.10)}
                #gc-splash-loader .gc-sq svg{width:52px;height:52px}
                #gc-splash-loader .gc-sq path{stroke:currentColor;stroke-width:5;stroke-linecap:round;fill:none;stroke-dasharray:120;stroke-dashoffset:120;animation:gcSplashDraw 900ms cubic-bezier(.22,1,.36,1) forwards;color:#F8FAFC}
                html[data-theme='light'] #gc-splash-loader .gc-sq path{color:#0F172A}
                #gc-splash-loader .gc-pct{margin-top:18px;font:700 14px/1 'Montserrat Variable','Montserrat',ui-sans-serif,system-ui,sans-serif;color:var(--sp-text);font-variant-numeric:tabular-nums;letter-spacing:.04em}
                #gc-splash-loader .gc-bar{width:148px;height:3px;border-radius:999px;background:var(--sp-track);overflow:hidden;margin-top:12px}
                #gc-splash-loader .gc-bar>i{display:block;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);animation:gcSplashBeam 1.05s linear infinite}
                #gc-splash-loader .gc-st{font:500 13px/1.4 'Montserrat Variable','Montserrat',ui-sans-serif,system-ui,sans-serif;color:var(--sp-text);margin-top:14px;min-height:18px}
                @media (prefers-reduced-motion:reduce){#gc-splash-loader .gc-bar>i,#gc-splash-loader .gc-sq path{animation:none}#gc-splash-loader .gc-sq path{stroke-dashoffset:0}}
            </style>
            <div class="gc-sq" aria-hidden="true"><svg viewBox="0 0 52 52"><path d="M40 14a17 17 0 1 0 2 20H27"/></svg></div>
            <div class="gc-pct" id="gc-splash-pct">00%</div>
            <div class="gc-bar"><i></i></div>
            <div class="gc-st" id="gc-splash-status">Ініціалізація GameCon OS...</div>
            <script>
                (function () {
                    var lines = ['Ініціалізація GameCon OS...', 'Предзавантаження інтерфейсу...', 'Синхронізація профілю та серверів...'];
                    var i = 0, el = document.getElementById('gc-splash-status');
                    var pctEl = document.getElementById('gc-splash-pct');
                    var skip = document.documentElement.classList.contains('gc-splash-skip');
                    var fast = skip;
                    var dur = fast ? 450 : 1000;
                    var started = performance.now();
                    var timer = skip ? 0 : setInterval(function () { i = (i + 1) % lines.length; if (el) el.textContent = lines[i]; }, Math.max(280, dur / lines.length));
                    var raf = 0;
                    function tick(now) {
                        var t = Math.min(1, (now - started) / dur);
                        if (pctEl) pctEl.textContent = String(Math.round(t * 100)).padStart(2, '0') + '%';
                        if (t < 1) raf = requestAnimationFrame(tick);
                    }
                    if (!skip) raf = requestAnimationFrame(tick); else if (pctEl) pctEl.textContent = '100%';
                    window.gcHideSplash = function () {
                        var s = document.getElementById('gc-splash-loader');
                        if (!s) return;
                        clearInterval(timer);
                        cancelAnimationFrame(raf);
                        if (pctEl) pctEl.textContent = '100%';
                        try { sessionStorage.setItem('gc_splash_seen', '1'); } catch (e) {}
                        if (skip) { s.parentNode && s.parentNode.removeChild(s); return; }
                        s.style.opacity = '0'; s.style.transform = 'scale(1.04)'; s.style.pointerEvents = 'none'; s.style.visibility = 'hidden';
                        setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 420);
                    };
                    window.addEventListener('load', function () { setTimeout(window.gcHideSplash, fast ? 500 : 2500); });
                })();
            </script>
        </div>
        <x-inertia::app />
        @if (($page['component'] ?? null) === 'welcome')
            @include('seo.home', ['name' => $seoName, 'description' => $seoDescription, 'email' => $seoEmail])
        @endif
    </body>
</html>
