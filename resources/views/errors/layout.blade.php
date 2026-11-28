{{-- Запасна сторінка помилки без JavaScript і збірки сайту (якщо не вдалося показати сторінку застосунку). --}}
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>@yield('code') · @yield('title') · GameCon</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <style>
        :root { color-scheme: dark light; --bg: #05070f; --card: rgb(16 26 50 / 0.85); --ink: #e9f0ff; --muted: #8c9cc2; --primary: #2f7bff; }
        @media (prefers-color-scheme: light) { :root { --bg: #e9f1f8; --card: rgb(255 255 255 / 0.9); --ink: #0d1b2e; --muted: #5a6d85; --primary: #1d6fe0; } }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg) radial-gradient(circle at 20% 10%, rgb(47 123 255 / 0.18), transparent 55%); color: var(--ink); font-family: Montserrat, system-ui, -apple-system, Segoe UI, sans-serif; }
        main { width: 100%; max-width: 420px; padding: 32px; border-radius: 24px; background: var(--card); text-align: center; box-shadow: 0 24px 60px -30px rgb(0 0 0 / 0.6); }
        .code { font-size: 56px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
        h1 { font-size: 20px; margin: 10px 0 6px; }
        p { color: var(--muted); font-size: 14px; line-height: 1.6; margin: 0; }
        a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin-top: 24px; padding: 0 20px; border-radius: 12px; background: var(--primary); color: #fff; font-weight: 600; text-decoration: none; }
    </style>
</head>
<body>
    <main>
        <p class="code">@yield('code')</p>
        <h1>@yield('title')</h1>
        <p>@yield('message')</p>
        <a href="/">На головну</a>
    </main>
</body>
</html>
