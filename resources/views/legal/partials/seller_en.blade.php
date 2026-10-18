{{-- Seller details (Law of Ukraine "On Electronic Commerce"); edited in Admin → Settings → Legal details. --}}
<ul class="legal-requisites">
    <li>Seller (service provider): <strong>{{ $legal['operator'] }}</strong>, individual entrepreneur (FOP) registered in Ukraine</li>
    @if($legal['tax_id'])<li>Taxpayer ID (RNOKPP): {{ $legal['tax_id'] }}</li>@endif
    @if($legal['registry'])<li>Unified State Register (EDR) record: {{ $legal['registry'] }}</li>@endif
    @if($legal['tax_status'])<li>Tax status: {{ $legal['tax_status'] }}</li>@endif
    @if($legal['address'])<li>Address: {{ $legal['address'] }}</li>@endif
    <li>E-mail: <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a></li>
    {{-- Телефон не показуємо на сайті: для зв’язку — лише e-mail. Номер лишається в Адмінка → Налаштування → Юридичні дані. --}}
    <li>Website: <a href="{{ $legal['site'] }}">{{ $legal['site'] }}</a></li>
</ul>
