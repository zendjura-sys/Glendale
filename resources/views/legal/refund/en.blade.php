{{-- Refund & Cancellation Policy — English translation. Master version: uk.blade.php. --}}
<p>This policy forms an integral part of the <a href="{{ $legal['site'] }}/terms">public offer</a> and explains how to cancel a subscription, withdraw from the contract and get a refund for paid {{ $legal['name'] }} products (GameCon+, GameCon+ for families, gifts and server promotion). It follows the Laws of Ukraine "On Consumer Rights Protection", "On Digital Content and Digital Services" and "On Electronic Commerce" and does not limit your statutory rights.</p>

<h2>1. How payment works</h2>
<ul>
    <li>Payment is by Visa or Mastercard card, Apple Pay, Google Pay or in the monobank app on the secure page of monobank (JSC "Universal Bank"). We never receive your card details.</li>
    <li>The service is activated as soon as the payment is credited. Payment history and receipts are in GameCon+ → Payments &amp; subscriptions.</li>
</ul>

<h2>2. Cancelling a subscription (auto-renewal)</h2>
<ul>
    <li>Auto-renewal is enabled only at your choice and can be turned off at any time in GameCon+ → Payments &amp; subscriptions with one click — no fees, penalties or minimum terms.</li>
    <li>After you turn it off, access continues until the end of the paid period; there will be no further charges.</li>
    <li>You can delete a saved card in the same place; auto-renewal with it switches to manual payment.</li>
</ul>

<h2>3. Right of withdrawal — 14 days</h2>
<p>The contract is concluded at a distance, so you may withdraw from it within <strong>14 days</strong> of payment without giving a reason.</p>
<p>Paid products are digital services supplied immediately. By clicking the payment button you ask us to start supplying the service before the 14-day period ends. Under consumer protection law, if you then withdraw, we refund the payment <strong>pro rata to the unused period</strong>; once the service has been fully supplied (for example, a promotion has ended), the right of withdrawal no longer applies.</p>
<p>Going beyond the law, we voluntarily refund the <strong>full amount</strong> if you contact us within 14 days and have not used the paid features since paying (for a gift — if the recipient has not used it; for promotion — if it has not started yet).</p>

<h2>4. Automatic renewal</h2>
<p>If you forgot to turn off auto-renewal and have not used paid features since the charge, write to us within 14 days and we will refund the renewal price in full.</p>

<h2>5. Faults, double charges, defective service</h2>
<ul>
    <li>A double charge or a charge without the service being supplied is refunded in full regardless of time limits.</li>
    <li>If a paid feature does not work through our fault and we have not fixed it within a reasonable time, we refund the relevant period in full or pro rata, at your choice, as provided by the Law "On Digital Content and Digital Services".</li>
</ul>

<h2>6. How refunds are paid</h2>
<ul>
    <li>Money is returned <strong>to the same card</strong> used for payment, via monobank, within 14 days of receiving your request. The time to appear on the card depends on the issuing bank (usually up to 7 business days).</li>
    <li>Any part of the price paid from the former {{ $legal['name'] }} account wallet balance is returned to that balance.</li>
    <li>With the refund, the related access (GameCon+, gift, promotion) ends.</li>
</ul>

<h2>7. When no refund is made</h2>
<ul>
    <li>After the service has been fully supplied, if you asked for it to start immediately (section 3).</li>
    <li>If the account was blocked for a serious breach of the <a href="{{ $legal['site'] }}/terms">offer</a> (fraud, illegal content, etc.), except where a refund is required by law.</li>
    <li>In case of abuse: repeated buy-and-refund cycles, or a chargeback filed while we are handling your request.</li>
</ul>

<h2>8. How to request a refund</h2>
<p>Write to <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a> from your account e-mail with your username, order number (GC-…, shown in payment history), date and reason. We reply within 3 business days.</p>

<h2>9. In-app purchases through Google Play</h2>
<ul>
    <li>A subscription bought in the Android app is cancelled in Google Play → Payments &amp; subscriptions; access continues until the end of the paid period.</li>
    <li>Refunds for such purchases are made by Google under Google Play's rules: request one at play.google.com (Order history → "Report a problem") within the periods set by Google. We can also initiate a refund — write to us with the GPA.… order number.</li>
    <li>When Google refunds a purchase it notifies us, and GameCon+ from that purchase is switched off automatically.</li>
</ul>

<h2>10. Chargebacks</h2>
<p>Please contact us before disputing a payment with your bank — it is faster. If the bank reverses a payment, the related access ends.</p>

<h2>11. Details</h2>
@include('legal.partials.seller_en')
