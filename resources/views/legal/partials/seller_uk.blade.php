{{-- Реквізити Виконавця (ЗУ «Про електронну комерцію»): заповнюються в Адмінка → Налаштування → Юридичні дані. --}}
<ul class="legal-requisites">
    <li>Виконавець: <strong>{{ $legal['operator'] }}</strong></li>
    @if($legal['tax_id'])<li>РНОКПП: {{ $legal['tax_id'] }}</li>@endif
    @if($legal['registry'])<li>Запис в ЄДР: {{ $legal['registry'] }}</li>@endif
    @if($legal['tax_status'])<li>Податковий статус: {{ $legal['tax_status'] }}</li>@endif
    @if($legal['address'])<li>Адреса для листування: {{ $legal['address'] }}</li>@endif
    <li>Види діяльності (КВЕД): 63.12, 63.11, 63.99 — електронні послуги веб-порталу</li>
    <li>E-mail: <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a></li>
    {{-- Телефон не показуємо на сайті: для зв’язку — лише e-mail. Номер лишається в Адмінка → Налаштування → Юридичні дані. --}}
    <li>Сайт: <a href="{{ $legal['site'] }}">{{ $legal['site'] }}</a></li>
</ul>
