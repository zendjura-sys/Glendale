{{-- Відвідування з країни, яку заблоковано в Адмінці → Країни. --}}
<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name') }}</title>
    <style>
        body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#05070f;color:#eef1ff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;box-sizing:border-box}
        .card{max-width:420px;text-align:center;padding:36px 28px;border-radius:24px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
        h1{margin:0 0 10px;font-size:22px}
        p{margin:0;color:#8b93b3;font-size:15px;line-height:1.6}
        small{display:block;margin-top:24px;color:#5c6385;font-size:11px}
        a{color:#8b93b3}
    </style>
</head>
<body>
    <div class="card">
        <h1>{{ $t($message) }}</h1>
        <p>{{ $t('Доступ із вашого регіону обмежено адміністрацією сайту.') }}</p>
        <small><a href="https://db-ip.com" rel="noopener">IP Geolocation by DB-IP</a></small>
    </div>
</body>
</html>
