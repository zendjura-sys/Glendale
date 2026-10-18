{{-- Contact details — English translation. Master version: uk.blade.php. --}}
<p>Have a question about your account, a GameCon+ payment, a refund or how {{ $legal['name'] }} works? Email us — we will help.</p>

<h2>How to reach us</h2>
<ul class="legal-requisites">
    <li>E-mail: <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a></li>
    @if($legal['address'])<li>Postal address: {{ $legal['address'] }}</li>@endif
    <li>Website: <a href="{{ $legal['site'] }}">{{ $legal['site'] }}</a></li>
</ul>
<p>We reply to payment and refund requests within 3 business days and to other requests within 14 days. When writing about a payment, include your account e-mail and the payment date so we can find it faster.</p>

<h2>Seller</h2>
@include('legal.partials.seller_en')

<p>Purchase and refund terms: <a href="/terms?lang=en">Public Offer</a>, <a href="/refund-policy?lang=en">Refund Policy</a>.</p>
