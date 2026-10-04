{!! $t($title ?? config('app.name')) !!}

{!! $t($intro) !!}
@isset($actionUrl)

{!! $t($actionText ?? 'Відкрити') !!}: {!! $actionUrl !!}
@endisset
@isset($outro)

{!! $t($outro) !!}
@endisset

— {!! config('app.name') !!}
