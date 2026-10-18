{{-- Реквізити продавця (ЗУ «Про електронну комерцію»): заповнюються в Адмінка → Налаштування → Юридичні дані. --}}
<ul class="legal-requisites">
    <li>Продавець (виконавець): <strong>{{ $legal['operator'] }}</strong></li>
    @if($legal['tax_id'])<li>РНОКПП: {{ $legal['tax_id'] }}</li>@endif
    @if($legal['registry'])<li>Запис в ЄДР: {{ $legal['registry'] }}</li>@endif
    @if($legal['tax_status'])<li>Податковий статус: {{ $legal['tax_status'] }}</li>@endif
    @if($legal['address'])<li>Місцезнаходження: {{ $legal['address'] }}</li>@endif
    <li>E-mail: <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a></li>
    @if($legal['phone'])<li>Телефон: <a href="tel:{{ preg_replace('/[^+\d]/', '', $legal['phone']) }}">{{ $legal['phone'] }}</a></li>@endif
    <li>Сайт: <a href="{{ $legal['site'] }}">{{ $legal['site'] }}</a></li>
</ul>
