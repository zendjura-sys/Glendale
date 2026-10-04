@php($money = fn (int $minor) => \App\Services\Families\PersonalBankDigest::money($minor))
Банк сім’ї · {{ $period }}
@foreach ($accounts as $account)

{!! $account['family'] !!} — {!! $account['member'] !!}
Залишок: {{ $money($account['balance']) }}
Надійшло: +{{ $money($account['income']) }} · Списано: −{{ $money($account['spent']) }}
@forelse ($account['operations'] as $op)
{{ $op['date'] }}  {!! $op['label'] !!}{!! $op['comment'] ? ' ('.$op['comment'].')' : '' !!}  {{ $op['amount'] > 0 ? '+' : '' }}{{ $money($op['amount']) }}
@empty
Операцій цього тижня не було.
@endforelse
Банк сім’ї: {{ url('/f/'.$account['slug'].'/bank') }}
@endforeach
@isset($unsubscribeUrl)

Не надсилати листи про активність: {!! $unsubscribeUrl !!}
@endisset
