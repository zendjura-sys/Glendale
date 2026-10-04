{!! $t($intro) !!}

{!! $t('Відкрити') !!}: {!! $actionUrl !!}
@isset($unsubscribeUrl)

{!! $t('Не надсилати листи про активність') !!}: {!! $unsubscribeUrl !!}
@endisset
