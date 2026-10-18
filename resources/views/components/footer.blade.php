{{--
    Наскрізний футер для Blade-сторінок (блокування країн, листи-сторінки тощо).
    На сторінках Inertia той самий футер — resources/js/components/gc/site-footer.tsx.
    Використання: <x-footer />
--}}
<footer style="margin-top:32px;padding:24px 16px;border-top:1px solid rgba(255,255,255,.06);text-align:center;font:12px/1.6 'Montserrat Variable',system-ui,sans-serif;color:rgba(255,255,255,.45)">
    <nav>
        <a href="{{ url('/terms') }}" style="color:inherit">{{ __('ui.terms') }}</a> |
        <a href="{{ url('/privacy') }}" style="color:inherit">{{ __('ui.privacy') }}</a> |
        <a href="{{ url('/refund-policy') }}" style="color:inherit">{{ __('ui.refund') }}</a>
    </nav>
    <p style="margin:8px 0 0">&copy; {{ date('Y') }} {{ config('app.name') }}. {{ __('ui.all_rights_reserved') }}</p>
</footer>
