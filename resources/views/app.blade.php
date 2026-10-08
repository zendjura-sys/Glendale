<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark" data-palette="{{ auth()->user()?->palette() ?? 'aurora' }}" style="color-scheme: dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#05070f">
        <meta name="color-scheme" content="dark">

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

        <script type="application/ld+json">
            {!! json_encode([
                '@@context' => 'https://schema.org',
                '@type' => 'WebSite',
                'name' => $seoName,
                'description' => $seoDescription,
                'url' => url('/'),
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) !!}
        </script>

        <style>
            html { background-color: #05070f; }
        </style>

        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/site.webmanifest">

        @fonts

        @php($locale = app()->getLocale())
        @if ($locale === 'uk')
            <script>window.__I18N__={locale:'uk',dict:{}};</script>
        @else
            <script src="{{ url('/i18n/'.$locale.'.js') }}?v={{ app(\App\Support\I18n\Translations::class)->version($locale) }}"></script>
        @endif
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'GameCon') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
