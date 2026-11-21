{{-- Новини GameCon (№284): розсилка з адмінки тим, хто погодився на листи з новинами. --}}
@extends('mail.layout', ['title' => $headline, 'preheader' => \Illuminate\Support\Str::limit($text, 120)])

@section('content')
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#A78BFA;">{{ $t('Новини {site}', ['site' => config('app.name')]) }}</p>
    <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;font-weight:700;color:#EEF1FF;">{{ $headline }}</h1>
    <p style="margin:0;font-size:16px;line-height:1.6;color:#C9CEE4;white-space:pre-line;">{{ $text }}</p>
    @include('mail.partials.button', ['url' => $actionUrl, 'label' => $t('Докладніше')])
@endsection

@section('footer')
    {{ $t('Ви отримали цей лист, бо погодилися на новини {site} у налаштуваннях.', ['site' => config('app.name')]) }}
    <br><a href="{{ $unsubscribeUrl }}" style="color:#8B93B3;">{{ $t('Відписатися від новин') }}</a>
@endsection
