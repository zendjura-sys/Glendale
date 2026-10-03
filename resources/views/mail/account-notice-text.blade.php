{!! $title ?? config('app.name') !!}

{!! $intro !!}
@isset($actionUrl)

{!! $actionText ?? 'Відкрити' !!}: {!! $actionUrl !!}
@endisset
@isset($outro)

{!! $outro !!}
@endisset

— {!! config('app.name') !!}
