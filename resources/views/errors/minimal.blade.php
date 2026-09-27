<!DOCTYPE html>
{{--
    Фірмова сторінка помилки — навмисно БЕЗ @vite() і БЕЗ Inertia/Vue: якщо
    впала сама збірка (зламаний manifest.json) чи JS-бандл, сторінка 500
    не повинна тягнути за собою ті самі залежності, інакше замість
    красивого фолбеку браузер отримає ще одну помилку поверх першої. Усі
    стилі — інлайн, шрифт — системний, жодних зовнішніх запитів.
--}}
<html lang="uk">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $code }} — {{ $title }}</title>
    <script>
        try {
            var t = localStorage.getItem('theme');
            if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
            document.documentElement.dataset.theme = t;
        } catch (e) {}
    </script>
    <style>
        :root { color-scheme: dark; }
        /* Світла тема сайту — ті самі кольори, що в соцмережі. */
        :root[data-theme='light'] { color-scheme: light; }
        :root[data-theme='light'] body { background: #f5f1e8 !important; background-image: none !important; color: #6b5f4b !important; }
        :root[data-theme='light'] .card, :root[data-theme='light'] [class*='card'] { background: rgba(255, 253, 248, 0.8) !important; box-shadow: 0 10px 30px -12px rgba(30, 35, 90, 0.18) !important; border-color: rgba(60, 44, 12, 0.08) !important; }
        :root[data-theme='light'] h1 { color: #1d1810 !important; }
        :root[data-theme='light'] .mark span { color: #9c7424 !important; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100svh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #060605;
            background-image:
                radial-gradient(60% 50% at 50% 0%, rgba(212, 175, 55, 0.10), transparent 60%),
                radial-gradient(40% 40% at 85% 90%, rgba(212, 175, 55, 0.06), transparent 60%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: rgba(255, 255, 255, 0.8);
        }
        .card {
            width: min(440px, 100%);
            text-align: center;
            padding: 48px 36px;
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(20px);
            box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.6);
        }
        .mark {
            width: 56px;
            height: 56px;
            margin: 0 auto 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            transform: rotate(45deg);
            border-radius: 12px;
            border: 1px solid rgba(212, 175, 55, 0.4);
            background: linear-gradient(135deg, rgba(212, 175, 55, 0.18), transparent);
        }
        .mark span {
            transform: rotate(-45deg);
            font-weight: 700;
            font-size: 22px;
            color: #e4cd8f;
        }
        .code {
            margin: 0;
            font-size: 15px;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: rgba(228, 205, 143, 0.7);
        }
        h1 {
            margin: 10px 0 12px;
            font-size: 26px;
            font-weight: 500;
            color: #fff;
        }
        p.message {
            margin: 0 0 30px;
            font-size: 14px;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.45);
        }
        a.btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 12px 28px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            text-decoration: none;
            color: #060605;
            background: linear-gradient(90deg, #b8933f, #e4cd8f, #b8933f);
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="mark"><span>G</span></div>
        <p class="code">Помилка {{ $code }}</p>
        <h1>{{ $title }}</h1>
        <p class="message">{{ $message }}</p>
        <a class="btn" href="{{ url('/') }}">На головну</a>
    </div>
</body>
</html>
