<!DOCTYPE html>
@php
    $design = App\Support\DesignSettings::all();
    $siteName = $design['siteName'] ?: config('app.name', 'GameConnect');
@endphp
<html lang="uk">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#0b0a08">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        @if ($design['faviconUrl'])
            <link rel="icon" href="{{ $design['faviconUrl'] }}">
        @endif
        <link rel="manifest" href="/manifest.webmanifest">
        <link rel="apple-touch-icon" href="/images/icons/apple-touch-icon.png">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="GameCon">
        <title>{{ $siteName }}</title>
        {{-- Тема до першої відмальовки — без спалаху світлого екрана. --}}
        <script>
            try {
                var t = localStorage.getItem('theme');
                if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                document.documentElement.dataset.theme = t;
            } catch (e) {}
            window.APP_BASE = @json($base);
        </script>
        @vite('resources/app/main.tsx')
    </head>
    <body>
        <div id="root"></div>
    </body>
</html>
