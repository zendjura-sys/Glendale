{{-- Terms of Service — English master version. Translations: resources/views/legal/terms/{locale}.blade.php --}}
<p>These Terms of Service (the “Terms”) govern your access to and use of {{ $legal['name'] }} at <a href="{{ $legal['site'] }}">{{ $legal['site'] }}</a>, its mobile applications, bots and related services (together, the “Service”). The Service is operated by <strong>{{ $legal['operator'] }}</strong> ({{ $legal['country'] }}@if($legal['address']), {{ $legal['address'] }}@endif) (“we”, “us”, “our”). By creating an account or using the Service you agree to these Terms. If you do not agree, do not use the Service.</p>

<h2>1. The Service</h2>
<p>{{ $legal['name'] }} is a social network for gamers and movie fans. It includes, among other things: profiles, posts, comments and reactions; private and group messaging; communities, families and clans; voice rooms and calls; a catalogue of games and multiplayer (including GTA role-play) servers with voting, reviews and server owner tools; “Party finder”; RP characters; moments (clips from YouTube, Twitch or Medal); live-stream badges; daily quests and seasons; an online cinema catalogue with embedded third-party video players and “watch together” rooms; music; Telegram and Discord bots; “Sign in with {{ $legal['name'] }}” for game servers; and the optional paid features described in section 7.</p>
<p>The Service is provided “as is” and evolves constantly. <strong>We may add, change, suspend or remove any feature, module, limit, design or content of the Service — including features included in paid plans — at any time, at our sole discretion and without prior notice or announcement</strong>, to the extent permitted by applicable law. Where such a change materially reduces a paid plan you have already paid for, your statutory consumer rights (including the right to a pro-rata refund where the law requires it) remain unaffected.</p>

<h2>2. Eligibility and accounts</h2>
<ul>
    <li>You must be at least 13 years old (or the minimum age of digital consent in your country, if higher, e.g. 16 in some EU member states) to use the Service. If you are under 18, you confirm that your parent or legal guardian has reviewed and agreed to these Terms, including any purchases.</li>
    <li>You must provide accurate information, keep your login details secure and are responsible for all activity under your account. Tell us immediately at <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a> if you suspect unauthorised use.</li>
    <li>One person may not create accounts to evade a ban, manipulate votes, ratings, quests, referrals or seasons, or impersonate others.</li>
    <li>You may sign in with Google, Discord or Telegram; your use of those services is governed by their own terms.</li>
</ul>

<h2>3. Your content</h2>
<p>You keep ownership of the content you post (text, images, audio, clips, links, server descriptions, RP characters, etc.). By posting it you grant us a worldwide, non-exclusive, royalty-free, sub-licensable licence to host, store, reproduce, adapt (for example resize or transcode), translate, display and distribute it for the purpose of operating, promoting and improving the Service. This licence ends when you delete the content or your account, except for copies retained as required by law, in backups for a limited time, or where the content was shared with and kept by other users.</p>
<p>You are solely responsible for your content and confirm you have all rights needed to post it. We may, but are not obliged to, review, moderate, blur, restrict or remove any content and use automated tools (such as profanity and spam filters and automated image checks) to do so.</p>

<h2>4. Acceptable use</h2>
<p>You must not:</p>
<ul>
    <li>break the law, infringe intellectual property or privacy rights, or post content that is illegal, sexually exploitative of minors, hateful, harassing, threatening, or promotes violence or self-harm;</li>
    <li>post sexually explicit content outside areas where it is allowed, spam, scams, phishing or malware;</li>
    <li>sell, buy or trade accounts, game currency or items for real money through the Service, or use the Service to organise fraud;</li>
    <li>scrape, reverse-engineer, overload or interfere with the Service, bypass limits or security, or use bots other than our official integrations;</li>
    <li>manipulate server votes, ratings, quests, seasons, referrals or promotions, including with multiple accounts;</li>
    <li>record or rebroadcast voice rooms or calls without the consent of participants.</li>
</ul>
<p>We may warn, mute, limit, suspend or terminate accounts, communities, families, clans or server listings that break these Terms, at our discretion.</p>

<h2>5. Game servers, families and in-game records</h2>
<p>Game servers, games and brands listed in the catalogue belong to their respective owners. {{ $legal['name'] }} is not affiliated with, endorsed or sponsored by Rockstar Games, Take-Two Interactive or any game publisher or server project unless expressly stated. Server owners are responsible for their listings, rules and communities.</p>
<p>Family and clan tools (banks, warehouses, reports, ranks, ratings, payouts and similar) are <strong>record-keeping tools for virtual in-game activity only</strong>. They do not hold, transfer or represent real money or any financial service, and we are not responsible for in-game outcomes, disputes between members or decisions of family or server leaders.</p>
<p>“Sign in with {{ $legal['name'] }}” for game servers shares only the data you approve on the consent screen. Third-party servers process that data under their own rules.</p>

<h2>6. Third-party content and embedded players</h2>
<p>The cinema section shows information from public databases (such as TMDB, IMDb and Shikimori) and embeds video players provided by independent third parties (such as Kodik, Videoseed and FlixCDN). <strong>We do not host, upload or store these video files</strong> and do not control their availability, quality, advertising or legality in your country. Moments, music and links may also embed content from YouTube, Twitch, Medal, Spotify and other services. Your use of third-party content is at your own risk and subject to the third party’s terms.</p>
<p>If you believe content on the Service infringes your rights, send a notice to <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a> with: the work concerned, the exact URL, your contact details, a statement of good-faith belief and a statement that the notice is accurate and you are authorised to act. We will remove or disable access to infringing material and may terminate repeat infringers.</p>

<h2>7. Paid features, personal account and payments</h2>
<ul>
    <li><strong>Personal account (wallet).</strong> Paid features are paid from your personal {{ $legal['name'] }} account balance (the “wallet”), shown in GameCon+ → Account. You top up the wallet through third-party donation and payment services listed on the top-up page (for example Donatello, Diaka, Donatik, Buy Me a Coffee or Patreon) by quoting the top-up code we give you. A payment you make to obtain paid features is a purchase, not a gift or charitable donation, even if the service calls it a “donation”.</li>
    <li><strong>Payment services.</strong> Each service processes your payment under its own terms and privacy policy; we do not receive or store your card details. Top-ups are credited automatically (where the service provides an API) or after manual verification, usually within 24 hours. In our Android app, purchases are made only through Google Play Billing under Google Play’s terms.</li>
    <li><strong>Wallet balance.</strong> The balance is kept in Ukrainian hryvnias, can be used only for paid features of the Service, is not a bank account, deposit or electronic money, bears no interest and cannot be transferred to another user. It cannot be withdrawn in cash except as a refund under the <a href="{{ $legal['site'] }}/refund-policy">Refund &amp; Cancellation Policy</a>. Before deleting your account, ask us to refund any refundable balance.</li>
    <li><strong>What you buy.</strong> GameCon+ is a prepaid digital service that unlocks optional cosmetic and convenience features for your account (or a family on the family plan) for the period you buy. A gift gives GameCon+ to another user for a fixed period. Server promotion gives a server listing paid placement, highlighting or a banner for a fixed period and is always labelled as advertising. Current features and prices are shown on the <a href="{{ $legal['site'] }}/pricing">Pricing</a> page and in the Service.</li>
    <li><strong>Changes to plans.</strong> To the extent permitted by law, we may at our discretion and without prior announcement add or remove features of GameCon+ and other paid products, change limits, move features between free and paid tiers, change prices for future purchases and renewals, and stop selling any product. Price changes never affect periods already paid. If you disagree with a new price, turn off auto-renewal.</li>
    <li><strong>Auto-renewal and cancellation.</strong> Auto-renewal is optional. When it is on, the price is charged from your wallet only (never from your card) about 24 hours before the paid period ends. If the balance is insufficient, we notify you and try again after you top up. You can turn auto-renewal off at any time in one click; access continues until the end of the paid period. Details, including the 14-day refund window, are in the Refund &amp; Cancellation Policy.</li>
    <li><strong>No cash value.</strong> Paid features, promo codes and gifts have no cash value, are personal and non-transferable except through the gift feature. Codes may have expiry dates and usage limits.</li>
    <li><strong>Fair use.</strong> Paid membership does not exempt you from these Terms. If your account is suspended or terminated for a serious breach (such as fraud, payment disputes in bad faith or illegal content), paid access and the wallet balance may end without refund, unless the law requires otherwise.</li>
</ul>

<h2>8. Our intellectual property</h2>
<p>The Service, its software, design, logos and the {{ $legal['name'] }} name are owned by us or our licensors and protected by law. We grant you a personal, revocable, non-exclusive, non-transferable licence to use the Service for its intended purpose. Open-source components are subject to their own licences.</p>

<h2>9. Suspension and termination</h2>
<p>You can delete your account at any time in the settings. We may suspend or terminate your access, or remove any listing or community, if you breach these Terms, if required by law, to protect users or the Service, or if we discontinue the Service. Sections that by their nature should survive termination (including 3, 6, 8, 10–13) will survive.</p>

<h2>10. Disclaimers</h2>
<p>To the maximum extent permitted by law, the Service is provided “as is” and “as available”, without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, non-infringement, availability or that the Service will be error-free or uninterrupted. We do not guarantee the accuracy of user content, catalogue data, server statistics or third-party content.</p>

<h2>11. Limitation of liability</h2>
<p>To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, consequential or punitive damages, or for loss of profits, data, goodwill or in-game items, arising from or related to the Service. Our total liability for any claim relating to the Service is limited to the greater of the amount you paid us for the Service in the 12 months before the claim or 50 EUR. Nothing in these Terms limits liability that cannot be limited by law, including for death or personal injury caused by negligence, fraud, or your statutory rights as a consumer.</p>

<h2>12. Indemnity</h2>
<p>You agree to indemnify us against claims, losses and costs (including reasonable legal fees) arising from your content, your breach of these Terms or your violation of any law or third-party right, to the extent permitted by law.</p>

<h2>13. Governing law and disputes</h2>
<p>These Terms are governed by the laws of {{ $legal['country'] }}, without regard to conflict-of-law rules. If you are a consumer, you also benefit from any mandatory protections of the law of your country of residence, and you may bring proceedings in the courts of that country. Before starting a formal dispute, please contact us so we can try to resolve it informally. EU consumers may also use the EU Online Dispute Resolution platform.</p>

<h2>14. Changes to these Terms</h2>
<p>We may update these Terms from time to time. The “Last updated” date shows the latest version. If changes are material, we will take reasonable steps to inform you (for example in the Service). By continuing to use the Service after changes take effect, you accept the updated Terms.</p>

<h2>15. Contact</h2>
<p>{{ $legal['operator'] }} — <a href="mailto:{{ $legal['email'] }}">{{ $legal['email'] }}</a>. Questions about a payment can also be sent to the donation or payment service you used.</p>
