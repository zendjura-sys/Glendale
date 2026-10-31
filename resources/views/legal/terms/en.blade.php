{{-- Public offer and terms of use — English translation. Master version: uk.blade.php. --}}
<p>This document is a <strong>public offer</strong> (an offer to enter into a contract) within the meaning of Articles 633, 641 and 642 of the Civil Code of Ukraine and, at the same time, the terms of use of {{ $legal['name'] }} at <a href="{{ $legal['site'] }}">{{ $legal['site'] }}</a>, in its mobile apps, bots and related services (together, the "Service"). The contract is concluded electronically under the Law of Ukraine "On Electronic Commerce" and has the same force as a written contract.</p>
<p>The Service is provided by <strong>{{ $legal['operator'] }}</strong> (the "Provider", "we"), whose details are listed in section 17. A person using the Service is the "User" or "you"; a User who orders paid electronic services is also the "Customer".</p>

<h2>Contact details</h2>
{{-- At the top of the offer so customers see right away how to reach us (Law "On Electronic Commerce", Art. 7). --}}
<ul class="legal-requisites">
    <li>Provider: <strong>{{ $legal['operator'] }}</strong></li>
    <li>E-mail: <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a> — account, payments, refunds and complaints</li>
    @if($legal['address'])<li>Postal address: {{ $legal['address'] }}</li>@endif
    <li>Website: <a href="{{ $legal['site'] }}">{{ $legal['site'] }}</a></li>
</ul>
<p>We reply to payment questions within 3 business days and to other requests within 14 days. The Provider's full details are in section 17.</p>

<h2>1. Acceptance</h2>
<ul>
    <li>You accept the free part of the contract (use of the Service) by creating an account or using the Service.</li>
    <li>You accept the paid part (sections 7–9) by clicking the payment button, agreeing to this offer and paying for the order. The contract for a paid product is concluded when the payment is credited.</li>
    <li>If you do not agree, do not use the Service.</li>
</ul>

<h2>2. The Service</h2>
<p>{{ $legal['name'] }} is a social network for gamers and film fans: profiles, posts, comments and reactions; private and group messages; communities, families and clans; voice rooms and calls; a catalogue of games and multiplayer (including GTA RP) servers; party finder; RP characters; moments (clips from YouTube, Twitch, Medal); quests and seasons; a film catalogue with embedded third-party players and watch-together rooms; music; Telegram and Discord bots; "Sign in with {{ $legal['name'] }}" for game servers; and optional paid features described in sections 7–9.</p>
<p>The Provider supplies <strong>electronic services of a web portal</strong> (NACE/KVED 63.12 "Web portals", 63.11 "Data processing, hosting and related activities", 63.99 "Other information service activities"). The Provider <strong>does not provide financial or payment services</strong>, does not issue electronic money, does not open accounts within the meaning of banking law and does not transfer funds between Users.</p>
<p>The core Service is free. We may develop the Service by adding, changing or removing features, design and limits. Changes affecting digital services already paid for are made only as permitted by the Law of Ukraine "On Digital Content and Digital Services", and material ones are announced in advance; if such a change materially impairs a paid service, you may terminate the contract and receive a pro-rata refund.</p>

<h2>3. Age and accounts</h2>
<ul>
    <li>The Service is intended for persons aged 13 and over. Users under 14 need the consent of their parents (legal guardians) to use the Service and for the processing of personal data.</li>
    <li>Paid products may be bought by adults, and by minors with the consent of their parents (legal guardians) within the limits of small everyday transactions permitted by law.</li>
    <li>You provide accurate information, keep your login details safe and are responsible for activity in your account. Report unauthorised access to <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a>.</li>
    <li>Creating accounts to evade bans, inflate votes, ratings, quests, invites or seasons, or to impersonate others is prohibited.</li>
</ul>

<h2>4. User content</h2>
<p>You keep the rights to your content. By posting it you grant us a free, non-exclusive, worldwide licence for as long as the content is in the Service to store, reproduce, adapt (resize or reformat), translate, display and distribute it within the Service in order to operate it. The licence ends when the content or account is deleted, except for backups kept for a limited time and copies saved by other users.</p>
<p>You are responsible for your content and confirm you hold all necessary rights. We may moderate, restrict or remove content that breaks the law or these terms, including with automated tools (profanity and spam filters, automatic image checks).</p>

<h2>5. Rules of use</h2>
<p>You must not:</p>
<ul>
    <li>break the laws of Ukraine, infringe intellectual property or privacy; post illegal content, child sexual exploitation, hate speech, propaganda of war or of the aggressor state, harassment, threats, calls for violence or self-harm;</li>
    <li>post explicit content outside permitted places, spam, scams, phishing or malware;</li>
    <li>sell or buy accounts, in-game currency or items for real money through the Service;</li>
    <li>scrape data, overload the Service, bypass limits or protection, or use unofficial bots;</li>
    <li>manipulate votes, ratings, quests, seasons, invites or promotion;</li>
    <li>record or rebroadcast voice rooms and calls without the participants' consent.</li>
</ul>
<p>For violations we may warn, mute, restrict, suspend or delete an account, community, family, clan or server listing.</p>
<p>Child sexual abuse and exploitation (CSAE) is prohibited without exception — see our <a href="/child-safety?lang=en">Child Safety Standards</a>. Such accounts are banned permanently and the material is reported to law enforcement.</p>

<h2>6. Game servers, families, third-party content</h2>
<p>Games, servers and brands in the catalogue belong to their owners; {{ $legal['name'] }} is not affiliated with game publishers or servers unless expressly stated. Family and clan tools (bank, storage, reports, ranks, payouts) only record virtual in-game activity and are not a financial service.</p>
<p>The film section shows information from open databases (TMDB, IMDb, Shikimori, etc.) and embeds players of independent third-party video providers. <strong>We do not host or store these video files</strong> and do not control their availability, quality or advertising. If content in the Service infringes your rights, send a notice to <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a> (the work, exact page address, your contact details, proof of rights) — we will review it and restrict access to such content as provided by the Law of Ukraine "On Copyright and Related Rights".</p>

<h2>7. Paid electronic services (contract for the supply of electronic services)</h2>
<h3>7.1. Subject</h3>
<p>The Provider supplies the Customer, for a fee, with electronic services of the web portal and access to digital content:</p>
<ul>
    <li><strong>GameCon+</strong> — access to additional cosmetic and convenience features of the account for the paid period;</li>
    <li><strong>GameCon+ for families</strong> — the same for a family (paid by the leader);</li>
    <li><strong>GameCon+ gift</strong> — GameCon+ for another user for a fixed period, without auto-renewal;</li>
    <li><strong>server promotion</strong> — a paid catalogue slot, highlighted card or banner for a fixed period; always labelled as advertising;</li>
    <li><strong>GameCon balance top-up</strong> — prepayment for electronic services of the portal (section 8);</li>
    <li><strong>community promotion</strong> and <strong>Author subscriptions</strong> — electronic services ordered with internal accounting units of the GameCon balance (sections 8 and 9).</li>
</ul>
<p>The list of plans, features, duration and price of each product are shown on the <a href="{{ $legal['site'] }}/pricing">Pricing</a> page and in the payment window. Prices are in Ukrainian hryvnias (UAH); the price shown in the payment window before confirmation is final.</p>

<h3>7.2. Payment</h3>
<ul>
    <li>Payment is made by Visa or Mastercard card, Apple Pay, Google Pay or in the monobank app on the secure payment page of <strong>monobank (JSC "Universal Bank")</strong>. Card details are entered on the bank's page; <strong>we do not receive or store them</strong>.</li>
    <li>Proof of payment is the bank receipt and the record in your payment history (GameCon+ → Payments &amp; subscriptions). A settlement document is provided electronically as required by the laws of Ukraine.</li>
    <li>Promo-code discounts, "old" prices and promotions apply as shown in the payment window. Promo codes have no cash value and cannot be exchanged for money.</li>
    <li>Internal accounting units of the GameCon balance (section 8), if any, are automatically applied to the price of your next order of electronic services; the rest is paid by card.</li>
</ul>

<h3>7.3. Supply</h3>
<p>The service is supplied <strong>immediately after the payment is credited</strong>, on the website and in the app. A new GameCon+ period starts after the current one ends, so paid days are never lost. A gift is credited to the recipient immediately; promotion starts immediately or from the first free slot shown before payment.</p>

<h3>7.4. Auto-renewal (subscription)</h3>
<ul>
    <li>Auto-renewal of GameCon+ and GameCon+ for families is enabled <strong>only at your explicit choice</strong> at checkout or in payment settings.</li>
    <li>If you agreed to save your card, monobank keeps it as a token (we only see a masked number). About a day before the paid period ends (as set in the subscription settings), the plan price in effect at renewal is charged to that card. We notify you of every charge in the Service.</li>
    <li>If a charge fails, we retry several times and notify you; after the last failed attempt auto-renewal is paused.</li>
    <li>You can turn off auto-renewal or delete the saved card at any time in GameCon+ → Payments &amp; subscriptions, with no fees or penalties. Access continues until the end of the paid period.</li>
    <li>We notify active subscribers of a price increase at least 7 days before the next charge; you can turn off auto-renewal before it.</li>
</ul>

<h3>7.5. Refunds</h3>
<p>Withdrawal and refunds are governed by the <a href="{{ $legal['site'] }}/refund-policy">Refund &amp; Cancellation Policy</a>, which forms an integral part of this offer.</p>

<h3>7.6. Android app</h3>
<p>In our Android app GameCon+ can be bought only through <strong>Google Play Billing</strong>: Google accepts the payment under Google Play's rules, and Google Play shows the price and period before payment. The subscription renews automatically until you cancel it in Google Play (Google Play → Payments &amp; subscriptions); access continues until the end of the paid period. We verify every purchase with Google and enable GameCon+ in your account on both the website and the app. Refunds for such purchases are handled through Google Play (see the Refund Policy).</p>

<h2>8. Internal account (GameCon balance) and settlements</h2>
<ul>
    <li>8.1. A top-up by the Customer of the internal account (GameCon account balance) by bank card through the payment gateway (monobank internet acquiring) is a <strong>100% prepayment (advance)</strong> to the Provider for electronic services of extended access to the functionality and digital content of the GameCon web portal. Top-ups are made in the packages shown in GameCon+ → Payments &amp; subscriptions; each UAH 1 paid credits 1 internal accounting unit to the balance.</li>
    <li>8.2. The electronic service of extended access is deemed fully supplied by the Provider and accepted by the Customer at the moment the corresponding number of internal accounting units is credited to the Customer's account balance on the portal. Crediting of the units is equivalent to signing an act of acceptance of the electronic services supplied. It is evidenced by the record in the payment history and the bank receipt.</li>
    <li>8.3. Internal accounting units on the GameCon account balance are <strong>solely a technical measure of the volume of electronic services prepaid by the Customer</strong> within the web portal. They are not electronic money, a means of payment, a currency or a financial asset within the meaning of the Law of Ukraine "On Payment Services", have no cash or non-cash monetary equivalent outside the web portal and cannot be withdrawn or exchanged for money to users' bank accounts or cards.</li>
    <li>8.4. Internal accounting units are used by the Customer only to order electronic services of the web portal: GameCon+, community promotion, Author subscriptions (section 9) and other services marked on the site. Units cannot be transferred directly to other Users, inherited or moved to another account.</li>
    <li>8.5. Refunds for a balance top-up are made under the <a href="{{ $legal['site'] }}/refund-policy">Refund Policy</a>, in particular for a double or erroneous charge or a technical failure that prevented the units from being credited. On a refund, the corresponding number of not-yet-used units is debited from the balance.</li>
</ul>

<h2>9. Paid Author subscriptions and access to restricted content</h2>
<ul>
    <li>9.1. The web portal gives users ("Authors") the technical ability to restrict access to their own publications (text, photo and audio materials, polls) and to open access to them for other users ("Subscribers") for internal accounting units of the GameCon balance. An Author may set up to three subscription tiers priced in units per 30 days.</li>
    <li>9.2. Taking out a paid subscription to an Author is the use of previously prepaid electronic services of the web portal to obtain temporary access (for <strong>30 calendar days</strong>) to the Author's restricted posts of the selected tier.</li>
    <li>9.3. When a subscription is taken out or automatically renewed, the corresponding number of internal accounting units is debited from the Subscriber's balance and allocated within the portal's accounting system: part of the units is credited to the Author's internal balance net of the platform service fee, which is 10% by default or another percentage set by the platform rules and shown to the Author in the subscription settings.</li>
    <li>9.4. Internal accounting units credited to an Author may be used only within the GameCon web portal to order the platform's internal electronic services (activating GameCon+, community promotion, subscriptions to other Authors) and <strong>are not paid out in money</strong>. The Provider does not make payouts to Authors and is not an intermediary in settlements between Users.</li>
    <li>9.5. A subscription is automatically renewed for the next 30 days by the system if the Subscriber's internal balance is sufficient, less than 24 hours before the current period ends. If units are insufficient, the subscription is not renewed and ends at the end of the paid period, and the Subscriber is notified. The Subscriber may turn off auto-renewal at any time in the profile settings ("Settings → Subscriptions → My subscriptions").</li>
    <li>9.6. Since access to the Author's restricted digital content is provided immediately after the internal units are debited from the Subscriber's balance, the service is deemed consumed when access is opened, and the debited internal units are not returned if the subscription is cancelled early.</li>
    <li>9.7. The Author is responsible for the restricted content they publish under sections 4 and 5. The Provider may close access to content that breaches this offer or the law, without returning units debited for access already provided.</li>
    <li>9.8. Author subscriptions and community promotion are available only on {{ $legal['site'] }}; they are not sold in the mobile app.</li>
</ul>

<h2>10. Provider's intellectual property</h2>
<p>The Service, its software, design, logos and the {{ $legal['name'] }} name belong to the Provider or its licensors. We grant you a personal, non-exclusive, non-transferable licence to use the Service as intended for the term of the contract. Open-source components are subject to their own licences.</p>

<h2>11. Term and termination</h2>
<p>The contract is concluded for an indefinite term and, for a paid service, until the end of the paid period. Unused GameCon balance units are cancelled when the account is deleted (section 8). You may delete your account at any time in settings. We may suspend or terminate access for breach of these terms, as required by law or to protect users. If an account is blocked for a serious breach, refunds are made only where required by law.</p>

<h2>12. Liability</h2>
<p>We make reasonable efforts to keep the Service running but do not guarantee it will be free of interruptions, and are not responsible for third-party content, catalogue data or other users' actions. Our liability to the User under the contract is limited to the amount paid for the relevant paid service. This limitation does not apply where prohibited by law and does not limit consumer rights under the laws of Ukraine.</p>

<h2>13. Personal data</h2>
<p>We process personal data under the Law of Ukraine "On Personal Data Protection" and our <a href="{{ $legal['site'] }}/privacy">Privacy Policy</a>. By accepting the offer you confirm you have read it.</p>

<h2>14. Force majeure</h2>
<p>The parties are released from liability for failure to perform due to force majeure (including martial law, hostilities, power or communication outages, decisions of public authorities) certified as provided by the laws of Ukraine.</p>

<h2>15. Complaints and disputes</h2>
<p>Send claims and requests to <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a>; we reply within 14 days (within 3 business days for payment matters). Disputes are resolved by negotiation and, failing that, in court under the laws of Ukraine. Consumers may also contact the State Service of Ukraine on Food Safety and Consumer Protection. This offer is governed by the laws of Ukraine; consumers from other countries keep the mandatory protection of the law of their country of residence.</p>

<h2>16. Changes</h2>
<p>We may amend this offer by publishing a new version on this page; the "Updated" date shows the current one. Changes do not affect periods already paid for. We announce material changes in the Service.</p>

<h2>17. Provider details</h2>
@include('legal.partials.seller_en')
