@php($money = fn (int $minor) => \App\Services\Families\PersonalBankDigest::money($minor))
{!! $t('Банк сім’ї') !!} · {{ $period }}
@foreach ($accounts as $account)

{!! $account['family'] !!} — {!! $account['member'] !!}
{!! $t('Залишок:') !!} {{ $money($account['balance']) }}
{!! $t('Надійшло:') !!} +{{ $money($account['income']) }} · {!! $t('Списано:') !!} −{{ $money($account['spent']) }}
@forelse ($account['operations'] as $op)
{{ $op['date'] }}  {!! $op['label'] !!}{!! $op['comment'] ? ' ('.$op['comment'].')' : '' !!}  {{ $op['amount'] > 0 ? '+' : '' }}{{ $money($op['amount']) }}
@empty
{!! $t('Операцій цього тижня не було.') !!}
@endforelse
{!! $t('Банк сім’ї') !!}: {{ url('/f/'.$account['slug'].'/bank') }}
@endforeach
@isset($unsubscribeUrl)

{!! $t('Не надсилати листи про активність') !!}: {!! $unsubscribeUrl !!}
@endisset
