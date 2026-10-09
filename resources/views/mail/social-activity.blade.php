{{-- Подія друзів, стрічки, спільноти чи сім’ї («Соцмережі»). --}}
@extends('mail.layout', ['title' => $t($intro), 'preheader' => $t($intro)])

@section('content')
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#A78BFA;">{{ $t('Нове на {site}', ['site' => config('app.name')]) }}</p>
    <p style="margin:0;font-size:17px;line-height:1.55;font-weight:600;color:#EEF1FF;">{{ $t($intro) }}</p>
    @include('mail.partials.button', ['url' => $actionUrl, 'label' => $t('Відкрити в {site}', ['site' => config('app.name')])])
@endsection

@section('footer')
    {{ $t('Ви отримали цей лист, бо це сповіщення з вашого акаунта {site}.', ['site' => config('app.name')]) }}
    @isset($unsubscribeUrl)
        <br><a href="{{ $unsubscribeUrl }}" style="color:#8B93B3;">{{ $t('Не надсилати листи про активність') }}</a>
    @endisset
@endsection
