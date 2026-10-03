{{--
    Фірмовий лист GameCon: темне тло, скляна картка, градієнтна кнопка — як на сайті.
    Лише таблиці та вбудовані стилі: так лист однаково виглядає в Gmail, Outlook і на телефоні.
--}}
@php($font = "'Montserrat','Segoe UI',Roboto,Helvetica,Arial,sans-serif")
<!DOCTYPE html>
<html lang="uk" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>{{ $title ?? config('app.name') }}</title>
<style>
    @media (max-width: 600px) {
        .gc-card { padding: 28px 20px !important; }
        .gc-title { font-size: 22px !important; }
    }
    a { color: #9AA6FF; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#05070F;">
@isset($preheader)
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#05070F;">{{ $preheader }}</div>
@endisset
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#05070F;background-image:radial-gradient(ellipse at top,#1B1640 0%,#05070F 60%);">
<tr>
<td align="center" style="padding:32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
            <td align="left" style="padding:0 4px 20px;">
                <a href="{{ config('app.url') }}" style="text-decoration:none;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td style="vertical-align:middle;">
                            <img src="{{ \App\Support\Mail\MailBrand::src() }}" width="44" height="44" alt="{{ config('app.name') }}" style="display:block;border:0;width:44px;height:44px;border-radius:12px;">
                        </td>
                        <td style="vertical-align:middle;padding-left:12px;font-family:{!! $font !!};font-size:22px;font-weight:800;letter-spacing:-0.3px;color:#EEF1FF;">
                            Game<span style="color:#A78BFA;">Con</span>
                        </td>
                    </tr></table>
                </a>
            </td>
        </tr>
        <tr>
            <td class="gc-card" style="background-color:#10142A;border:1px solid #232A4A;border-radius:24px;padding:36px 32px;font-family:{!! $font !!};color:#EEF1FF;">
                @yield('content')
            </td>
        </tr>
        <tr>
            <td style="padding:20px 8px 0;font-family:{!! $font !!};font-size:12px;line-height:1.6;color:#5C6385;text-align:center;">
                @yield('footer')
                <div style="margin-top:8px;">© {{ date('Y') }} {{ config('app.name') }} · Соцмережа українського гейм-ком’юніті</div>
            </td>
        </tr>
    </table>
</td>
</tr>
</table>
</body>
</html>
