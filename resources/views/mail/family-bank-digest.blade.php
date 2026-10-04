{{-- Тижнева зведення особистого рахунку в банку сім’ї. --}}
@php($money = fn (int $minor) => \App\Services\Families\PersonalBankDigest::money($minor))
@extends('mail.layout', ['title' => 'Ваш рахунок у сім’ї за тиждень', 'preheader' => 'Залишок і операції за '.$period])

@section('content')
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#A78BFA;">Банк сім’ї · {{ $period }}</p>
    @foreach ($accounts as $account)
        <div style="margin:18px 0 0;padding:16px 18px;border-radius:16px;background:#151A30;border:1px solid rgba(255,255,255,0.08);">
            <p style="margin:0;font-size:16px;font-weight:700;color:#EEF1FF;">{{ $account['family'] }}</p>
            <p style="margin:2px 0 12px;font-size:13px;color:#8B93B3;">{{ $account['member'] }}</p>
            <p style="margin:0;font-size:13px;color:#8B93B3;">Залишок на рахунку</p>
            <p style="margin:2px 0 10px;font-size:24px;font-weight:800;color:#F5C451;">{{ $money($account['balance']) }}</p>
            <p style="margin:0 0 10px;font-size:13px;color:#DFE3F7;">
                Надійшло: <b style="color:#34D399;">+{{ $money($account['income']) }}</b> ·
                Списано: <b style="color:#FF8FA3;">−{{ $money($account['spent']) }}</b>
            </p>
            @if ($account['operations'] === [])
                <p style="margin:0;font-size:13px;color:#8B93B3;">Операцій цього тижня не було.</p>
            @else
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#DFE3F7;">
                    @foreach ($account['operations'] as $op)
                        <tr>
                            <td style="padding:6px 0;border-top:1px solid rgba(255,255,255,0.06);color:#8B93B3;white-space:nowrap;">{{ $op['date'] }}</td>
                            <td style="padding:6px 8px;border-top:1px solid rgba(255,255,255,0.06);">{{ $op['label'] }}@if ($op['comment'])<br><span style="color:#8B93B3;">{{ $op['comment'] }}</span>@endif</td>
                            <td align="right" style="padding:6px 0;border-top:1px solid rgba(255,255,255,0.06);white-space:nowrap;font-weight:700;color:{{ $op['amount'] < 0 ? '#FF8FA3' : '#34D399' }};">{{ $op['amount'] > 0 ? '+' : '' }}{{ $money($op['amount']) }}</td>
                        </tr>
                    @endforeach
                </table>
            @endif
            @include('mail.partials.button', ['url' => url('/f/'.$account['slug'].'/bank'), 'label' => 'Відкрити банк сім’ї'])
        </div>
    @endforeach
@endsection

@section('footer')
    Ви отримали цей лист, бо перебуваєте в сім’ї на {{ config('app.name') }}. Зведення приходить щонеділі.
    @isset($unsubscribeUrl)
        <br><a href="{{ $unsubscribeUrl }}" style="color:#8B93B3;">Не надсилати листи про активність</a>
    @endisset
@endsection
