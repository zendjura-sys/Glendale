@extends('mail.layout', ['title' => $t('Відписку оформлено')])

@section('content')
    <h1 class="gc-title" style="margin:0 0 14px;font-size:26px;line-height:1.25;font-weight:800;color:#EEF1FF;">{{ $t('Готово, листів про активність більше не буде') }}</h1>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#DFE3F7;">{{ $t('Службові листи — підтвердження пошти й скидання пароля — приходитимуть і далі. Сповіщення лишаються на сайті й у застосунку.') }}</p>
    @include('mail.partials.button', ['url' => $settingsUrl, 'label' => $t('Увімкнути знову в налаштуваннях')])
@endsection
