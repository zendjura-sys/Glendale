<?php

namespace App\Support\Settings;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

class SiteSettings
{
    private const CACHE_KEY = 'site.settings';

    /** @var array<string, mixed> */
    public const DEFAULTS = [
        'site_name' => 'GameCon',
        'tagline' => 'Соціальна мережа нового покоління',
        'seo_description' => 'GameCon — соціальна мережа для геймерів і кіноманів: друзі, спільноти, музика, кіно, сімʼї та ігрові сервери.',
        'play_store_enabled' => false,
        'play_store_url' => null,
        'play_store_badge' => 'get',
        'registration_open' => true,
        'email_verification' => false,
        'max_post_length' => 5000,
        'max_attachments' => 10,
        'max_upload_mb' => 20,
        'max_message_file_mb' => 50,
        'music_max_track_mb' => 30,
        'spotify_client_id' => null,
        'spotify_client_secret' => null,
        'kodik_token' => null,
        'kodik_links_key' => null,
        'videoseed_token' => null,
        // Порядок, назви й фільтри плеєрів (CinemaPlayers) і автопарсинг TMDB (TmdbAutoParse).
        'cinema_players' => [],
        'cinema_tmdb' => [],
        'flixcdn_token' => null,
        'flixcdn_template' => null,
        'flixcdn_api_search' => null,
        'flixcdn_api_updates' => null,
        // Параметр адреси плеєра FlixCDN, що вибирає озвучку (кожна озвучка — окремий плеєр).
        'flixcdn_translation_param' => null,
        'tmdb_token' => null,
        'tmdb_language' => 'uk-UA',
        'omdb_key' => null,
        'rawg_key' => null,
        'igdb_client_id' => null,
        'igdb_client_secret' => null,
        'games_features' => [],
        'discord_bot_token' => null,
        'discord_guild_id' => null,
        'steam_api_key' => null,
        'deepl_key' => null,
        'moderation' => [],
        // Мови інтерфейсу: [{code, enabled}], українська — завжди; типова — для решти відвідувачів.
        'languages' => [],
        'default_locale' => 'uk',
        // Кнопка «Перекласти» під записами (потрібен ключ DeepL).
        'content_translation' => true,
        // Блокування країн: ISO-коди; база IP → країна; Cloudflare визначає країну сам.
        'geo_blocked' => [],
        'geo_trust_cloudflare' => false,
        'geo_db_source' => null,
        'geo_db_updated_at' => null,
        'maxmind_account_id' => null,
        'maxmind_license_key' => null,
        'shikimori_enabled' => true,
        'shikimori_url' => null,
        'cinema_auto' => [],
        'cinema_sync_last' => null,
        'maintenance_message' => null,
        'servers_auto_publish' => false,
        'plugins' => [],
        'discord_client_id' => null,
        'discord_client_secret' => null,
        'firebase_api_key' => null,
        'firebase_auth_domain' => null,
        'firebase_project_id' => null,
        'firebase_app_id' => null,
        'fcm_service_account' => null,
        'livekit_url' => null,
        'livekit_api_key' => null,
        'livekit_api_secret' => null,
        'vapid_public' => null,
        'telegram_bot_token' => null,
        'telegram_bot_username' => null,
        'telegram_webhook_secret' => null,
        'discord_public_key' => null,
        'twitch_client_id' => null,
        'twitch_client_secret' => null,
        'sightengine_user' => null,
        'sightengine_secret' => null,
        'vapid_private' => null,
        // Реквізити продавця на /terms, /privacy, /refund-policy (порожнє — значення з config/legal.php / .env).
        'legal_operator' => null,
        'legal_email' => null,
        'legal_address' => null,
        'legal_country' => null,
        'legal_updated' => null,
        // Реквізити ФОП для документів і підвалу (Закон «Про електронну комерцію», ст. 7).
        'legal_tax_id' => null,
        'legal_registry' => null,
        'legal_phone' => null,
        'legal_tax_status' => null,
        // Старі способи поповнення рахунку й токен Donatello (баланс прибрано; лишаються для історії).
        'plus_methods' => [],
        // Товари, зняті з продажу (ключі config('plus.products')): зникають зі сторінок цін і GameCon+.
        'plus_disabled' => [],
        'donatello_token' => null,
        // Оплата карткою: токен еквайрингу monobank, тарифи й правила підписок (Catalog), Google Pay.
        'monobank_acquiring_token' => null,
        'billing_products' => [],
        'billing_rules' => [],
        'google_pay' => [],
        // Підписки GameCon+ у застосунку через Google Play Billing (GooglePlay).
        'google_play_enabled' => false,
        'google_play_package' => null,
        'google_play_products' => null,
        'google_play_service_account' => null,
        'google_play_rtdn_token' => null,
    ];

    /** Ключі, які не можна віддавати у фронтенд. */
    public const SECRETS = ['spotify_client_secret', 'kodik_token', 'kodik_links_key', 'videoseed_token', 'flixcdn_token', 'tmdb_token', 'omdb_key', 'discord_client_secret', 'fcm_service_account', 'livekit_api_secret', 'rawg_key', 'igdb_client_secret', 'discord_bot_token', 'steam_api_key', 'deepl_key', 'maxmind_license_key', 'vapid_private', 'telegram_bot_token', 'telegram_webhook_secret', 'twitch_client_secret', 'sightengine_secret', 'donatello_token', 'monobank_acquiring_token', 'google_play_service_account', 'google_play_rtdn_token'];

    /** @var array<string, mixed>|null */
    private ?array $values = null;

    public function get(string $key, mixed $default = null): mixed
    {
        $values = $this->all();

        return array_key_exists($key, $values) ? $values[$key] : $default;
    }

    /**
     * @return array<string, mixed>
     */
    public function all(): array
    {
        return $this->values ??= array_replace(self::DEFAULTS, Cache::rememberForever(
            self::CACHE_KEY,
            fn () => DB::table('site_settings')->pluck('value', 'key')
                ->map(fn ($value) => json_decode((string) $value, true))
                ->all(),
        ));
    }

    /**
     * @return array<string, mixed>
     */
    public function public(): array
    {
        return array_diff_key($this->all(), array_flip(self::SECRETS));
    }

    public function secret(string $key): ?string
    {
        $value = $this->get($key);

        try {
            return is_string($value) && $value !== '' ? Crypt::decryptString($value) : null;
        } catch (DecryptException) {
            return null;
        }
    }

    public function putSecret(string $key, ?string $value): void
    {
        $this->put([$key => $value === null || $value === '' ? null : Crypt::encryptString($value)]);
    }

    public function seoDescription(): string
    {
        $value = $this->get('seo_description');

        return is_string($value) && trim($value) !== ''
            ? trim($value)
            : (string) self::DEFAULTS['seo_description'];
    }

    public function playStoreUrl(): ?string
    {
        if (! $this->get('play_store_enabled')) {
            return null;
        }

        $url = $this->get('play_store_url');

        return is_string($url) && preg_match('#\Ahttps?://#i', $url) === 1 ? $url : null;
    }

    /** Офіційний значок Google Play: «Get it on» (застосунок опубліковано) або «Pre-register» (попередня реєстрація). */
    public function playStoreBadge(): string
    {
        return $this->get('play_store_badge') === 'preregister' ? 'preregister' : 'get';
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function put(array $values): void
    {
        $now = now();

        foreach ($values as $key => $value) {
            DB::table('site_settings')->updateOrInsert(
                ['key' => $key],
                ['value' => json_encode($value), 'updated_at' => $now, 'created_at' => $now],
            );
        }

        $this->values = null;
        Cache::forget(self::CACHE_KEY);
    }
}
