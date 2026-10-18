{{-- Privacy Policy — English translation. Master version: uk.blade.php. --}}
<p>This Policy explains how <strong>{{ $legal['operator'] }}</strong> — the owner of personal data under the Law of Ukraine "On Personal Data Protection" and the controller under the GDPR — collects, uses and protects personal data of {{ $legal['name'] }} users (<a href="{{ $legal['site'] }}">{{ $legal['site'] }}</a>, the mobile app and bots). Contact for personal data matters: <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a>.</p>

<h2>1. Data we process</h2>
<ul>
    <li><strong>Account data:</strong> name, username, e-mail, password (hashed only), optional profile data (avatar, cover, city, country, birthday, gender, website, bio), language and settings.</li>
    <li><strong>Content and activity:</strong> posts, comments, reactions, messages, voice notes, photos, clips, RP characters, activity in families, clans and communities, votes, quests, film lists and ratings.</li>
    <li><strong>Connected accounts</strong> (only if you connect them): identifiers and public data from Google, Discord, Telegram, Steam, Spotify, Twitch or YouTube.</li>
    <li><strong>Technical data:</strong> IP address, approximate country, device and browser data, logs, sessions and security events, push tokens.</li>
    <li><strong>Payment data:</strong> order number, product, amount, status, date, monobank payment ID, <strong>masked card number</strong> (e.g. 4441 11** **** 1234) and card network. If you agreed to save a card for auto-renewal, we store only the card token issued by monobank, encrypted. <strong>We never receive or store the full card number, expiry date or CVV</strong> — they are handled by the bank.</li>
    <li><strong>Voice:</strong> voice rooms and calls are relayed in real time through our media server and are <strong>not recorded</strong>.</li>
</ul>

<h2>2. Purposes and legal bases</h2>
<ul>
    <li>Providing the Service, the account, messaging, notifications — <em>performance of the contract</em> (public offer).</li>
    <li>Accepting payments, auto-renewal, refunds, income records and tax reporting of the entrepreneur — <em>contract</em> and <em>legal obligation</em>.</li>
    <li>Security, moderation, spam and fraud prevention, automatic image checks — <em>legitimate interest</em>.</li>
    <li>Improving the Service, anonymised statistics — <em>legitimate interest</em>.</li>
    <li>Optional e-mails and push notifications, connected accounts — <em>consent</em>, which you can withdraw in settings.</li>
</ul>

<h2>3. Who we share data with</h2>
<p>We do not sell personal data. We share it only as needed to run the Service:</p>
<ul>
    <li><strong>monobank (JSC "Universal Bank")</strong> — accepting payments, card tokens, refunds; the bank processes card data under its own policy;</li>
    <li>Google (Google Pay — if you pay with it; Google Play — in-app purchases; Firebase — push notifications);</li>
    <li>hosting, storage, e-mail and backup providers;</li>
    <li>Sightengine — automatic checks of uploaded images; DeepL — only text you ask to translate;</li>
    <li>Google, Discord, Telegram, Steam, Spotify, Twitch — only when you use the relevant feature;</li>
    <li>game servers you authorised via "Sign in with {{ $legal['name'] }}" — within the permissions you granted;</li>
    <li>public authorities — in cases and in the manner required by law.</li>
</ul>
<p>Embedded third-party players and media (Kodik, Videoseed, FlixCDN, YouTube, Twitch, etc.) load from their servers and may process your IP address and set cookies under their own rules.</p>

<h2>4. Cross-border transfers</h2>
<p>Some providers process data outside Ukraine. We transfer data only to countries ensuring adequate protection or with safeguards required by law (including standard contractual clauses).</p>

<h2>5. Retention</h2>
<p>Account data is kept while the account is active. After account deletion we delete or anonymise data within 30 days, except data we must keep by law: payment records and settlement documents are kept for the periods set by tax and accounting laws (generally 3 years, longer in some cases). Security logs are kept for a limited time; backups are overwritten over time.</p>

<h2>6. Your rights</h2>
<p>Under Article 8 of the Law of Ukraine "On Personal Data Protection" (and, for EU residents, the GDPR) you have the right to know what data we process and why; to access it; to request correction or deletion; to object to or restrict processing; to withdraw consent; and to receive your data in a machine-readable format. Many actions are available in account settings (export, deletion); others on request at <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a>; we reply within 30 days. You may complain to the Ukrainian Parliament Commissioner for Human Rights or a court, and EU residents to their data protection authority.</p>

<h2>7. Cookies and local storage</h2>
<p>We use only necessary cookies (session, security, CSRF protection, language) and local storage for preferences (player, appearance). There are no third-party advertising or analytics cookies. The monobank payment page and the Google Pay button may use the bank's and Google's own cookies.</p>

<h2>8. Children</h2>
<p>The Service is not intended for children under 13. Data of users under 14 is processed with the consent of their parents (legal guardians). If you believe a child has given us data without the required consent, contact us and we will delete it.</p>

<h2>9. Security</h2>
<p>We use encryption in transit (HTTPS), password hashing, encrypted storage of card tokens and secret keys, two-factor authentication and passkeys, access control and monitoring. Every bank notification is signature-checked to prevent forged payments.</p>

<h2>10. Changes</h2>
<p>We may update this Policy; the "Updated" date shows the current version. We will announce material changes in the Service.</p>

<h2>11. Data owner</h2>
@include('legal.partials.seller_en')
