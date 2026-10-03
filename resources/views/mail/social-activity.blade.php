{{-- Подія друзів, стрічки, спільноти чи сім’ї («Соцмережі»). --}}
@extends('mail.layout', ['title' => $intro, 'preheader' => $intro])

@section('content')
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#A78BFA;">Нове на {{ config('app.name') }}</p>
    <p style="margin:0;font-size:17px;line-height:1.55;font-weight:600;color:#EEF1FF;">{{ $intro }}</p>
    @include('mail.partials.button', ['url' => $actionUrl, 'label' => 'Відкрити в '.config('app.name')])
@endsection

@section('footer')
    Ви отримали цей лист, бо це сповіщення з вашого акаунта {{ config('app.name') }}.
    @isset($unsubscribeUrl)
        <br><a href="{{ $unsubscribeUrl }}" style="color:#8B93B3;">Не надсилати листи про активність</a>
    @endisset
@endsection
