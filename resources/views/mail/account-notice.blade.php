{{-- Службовий лист акаунта («Оповіщення»): підтвердження пошти, скидання пароля, перевірка пошти. --}}
@extends('mail.layout', ['title' => $title ?? config('app.name'), 'preheader' => $intro])

@section('content')
    <h1 class="gc-title" style="margin:0 0 14px;font-size:26px;line-height:1.25;font-weight:800;letter-spacing:-0.4px;color:#EEF1FF;">{{ $title ?? config('app.name') }}</h1>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#DFE3F7;">{{ $intro }}</p>
    @isset($actionUrl)
        @include('mail.partials.button', ['url' => $actionUrl, 'label' => $actionText ?? 'Відкрити'])
    @endisset
    @isset($outro)
        <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#8B93B3;">{{ $outro }}</p>
    @endisset
    @isset($actionUrl)
        <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #232A4A;font-size:12px;line-height:1.6;color:#5C6385;">
            Кнопка не працює? Скопіюйте посилання в браузер:<br>
            <a href="{{ $actionUrl }}" style="color:#9AA6FF;word-break:break-all;">{{ $actionUrl }}</a>
        </p>
    @endisset
@endsection

@section('footer')
    Це службовий лист — він приходить, коли ви щось робите з акаунтом. Відповідати на нього не потрібно.
@endsection
