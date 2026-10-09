<?php

namespace App\Services\Games;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * IGDB (база ігор Twitch): мультиплеєрні ігри з платформами, жанрами, обкладинками й посиланнями на магазини.
 * Доступ — Client ID і Client Secret застосунку з dev.twitch.tv; токен застосунку кешується до закінчення строку.
 */
class Igdb
{
    /** Ігрові режими IGDB: мультиплеєр, кооператив, MMO, королівська битва. */
    public const MULTIPLAYER_MODES = '2,3,5,6';

    /** Платформи IGDB для розділів каталогу. */
    public const GROUPS = [
        'pc' => '6',
        'mobile' => '34,39',
        'console' => '48,167,49,169,130',
    ];

    /** Платформи IGDB (id) → наші. */
    public const PLATFORMS = [
        6 => 'pc', 14 => 'mac', 3 => 'linux', 34 => 'android', 39 => 'ios',
        48 => 'playstation', 167 => 'playstation', 9 => 'playstation',
        49 => 'xbox', 169 => 'xbox', 12 => 'xbox', 130 => 'switch',
    ];

    public function __construct(private readonly SiteSettings $settings) {}

    public function clientId(): ?string
    {
        $value = $this->settings->get('igdb_client_id') ?: config('services.igdb.client_id');

        return is_string($value) && $value !== '' ? $value : null;
    }

    private function clientSecret(): ?string
    {
        $value = $this->settings->secret('igdb_client_secret') ?? config('services.igdb.client_secret');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function configured(): bool
    {
        return $this->clientId() !== null && $this->clientSecret() !== null;
    }

    /** Перевірка ключів з адмінки: свіжий токен і один запит до бази. */
    public function test(): bool
    {
        $this->forgetToken();

        return $this->query('games', 'fields name; limit 1;') !== null;
    }

    /** Поля гри, які забираємо з IGDB (довідники — за id, щоб не залежати від мови й перейменувань). */
    private const FIELDS = 'name,slug,url,summary,storyline,first_release_date,platforms,genres,themes,game_modes,player_perspectives,'
        .'total_rating,total_rating_count,aggregated_rating,aggregated_rating_count,rating,rating_count,hypes,'
        .'cover.image_id,screenshots.image_id,artworks.image_id,videos.video_id,videos.name,websites.url,alternative_names.name,'
        .'involved_companies.developer,involved_companies.publisher,involved_companies.company.name,game_engines.name,'
        .'franchises.name,collections.name,similar_games,age_ratings.*,multiplayer_modes.*,release_dates.platform,release_dates.date,'
        .'language_supports.language.name,language_supports.language_support_type';

    /**
     * Сторінка популярних мультиплеєрних ігор розділу з усіма даними для картки гри.
     * Еротичні ігри (тема 42) у каталог не потрапляють.
     *
     * @return list<array<string, mixed>>|null
     */
    public function games(string $category, int $offset, int $limit = 250): ?array
    {
        $platforms = self::GROUPS[$category] ?? self::GROUPS['pc'];
        $body = 'fields '.self::FIELDS.';'
            .' where game_modes = ('.self::MULTIPLAYER_MODES.') & platforms = ('.$platforms.') & version_parent = null & parent_game = null'
            .' & themes != (42) & total_rating_count > '.($category === 'mobile' ? '0' : '2').';'
            .' sort total_rating_count desc; limit '.$limit.'; offset '.$offset.';';

        return $this->query('games', $body);
    }

    /**
     * Скільки годин займає проходження (дані гравців IGDB).
     *
     * @param  list<int>  $ids
     * @return array<int, array{hastily: int|null, normally: int|null, completely: int|null}>
     */
    public function timeToBeat(array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        $rows = $this->query('game_time_to_beats', 'fields game_id,hastily,normally,completely; where game_id = ('.implode(',', $ids).'); limit 500;') ?? [];
        $hours = fn ($s) => is_numeric($s) && $s > 0 ? (int) max(1, round($s / 3600)) : null;
        $out = [];
        foreach ($rows as $row) {
            $id = (int) ($row['game_id'] ?? 0);
            if ($id > 0) {
                $out[$id] = ['hastily' => $hours($row['hastily'] ?? null), 'normally' => $hours($row['normally'] ?? null), 'completely' => $hours($row['completely'] ?? null)];
            }
        }

        return $out;
    }

    /**
     * Ігрові події IGDB (шоукейси, презентації, трансляції), що починаються в проміжку.
     *
     * @return list<array<string, mixed>>|null
     */
    public function events(int $from, int $to): ?array
    {
        return $this->query('events', 'fields name,description,start_time,end_time,live_stream_url,event_logo.image_id,games,event_networks.url;'
            .' where start_time >= '.$from.' & start_time <= '.$to.'; sort start_time asc; limit 200;');
    }

    /**
     * Дати виходу ігор (за IGDB id) у проміжку — по одній на платформу.
     *
     * @param  list<int>  $ids
     * @return list<array<string, mixed>>|null
     */
    public function releaseDates(array $ids, int $from, int $to): ?array
    {
        if ($ids === []) {
            return [];
        }

        return $this->query('release_dates', 'fields game,date,platform;'
            .' where game = ('.implode(',', $ids).') & date >= '.$from.' & date <= '.$to.'; limit 500;');
    }

    /** Посилання IGDB → ключ магазину за адресою (не залежить від довідників IGDB, які змінюються). */
    public static function storeOf(string $url): ?string
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        return match (true) {
            str_ends_with($host, 'steampowered.com') => 'steam',
            $host === 'play.google.com' => 'gplay',
            in_array($host, ['apps.apple.com', 'itunes.apple.com'], true) => 'appstore',
            str_ends_with($host, 'epicgames.com') => 'epic',
            str_ends_with($host, 'gog.com') => 'gog',
            str_ends_with($host, 'itch.io') => 'itch',
            str_ends_with($host, 'playstation.com') => 'playstation',
            str_ends_with($host, 'xbox.com'), $host === 'apps.microsoft.com' => 'xbox',
            str_ends_with($host, 'nintendo.com') => 'nintendo',
            default => null,
        };
    }

    public static function cover(?string $imageId): ?string
    {
        return self::image($imageId, 'cover_big');
    }

    /** Картинка IGDB потрібного розміру (cover_big, screenshot_big, 1080p…). */
    public static function image(?string $imageId, string $size): ?string
    {
        return $imageId && preg_match('/^[a-z0-9]+$/', $imageId) === 1 ? 'https://images.igdb.com/igdb/image/upload/t_'.$size.'/'.$imageId.'.jpg' : null;
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    private function query(string $endpoint, string $body, bool $retry = true): ?array
    {
        $token = $this->token();
        $clientId = $this->clientId();
        if ($token === null || $clientId === null) {
            return null;
        }
        try {
            $response = Http::timeout(20)->acceptJson()
                ->withHeaders(['Client-ID' => $clientId])
                ->withToken($token)
                ->withBody($body, 'text/plain')
                ->post(rtrim((string) config('services.igdb.url', 'https://api.igdb.com/v4'), '/').'/'.$endpoint);
        } catch (ConnectionException) {
            return null;
        }
        if ($response->status() === 401 && $retry) {
            $this->forgetToken();

            return $this->query($endpoint, $body, false);
        }
        $data = $response->successful() ? $response->json() : null;

        return is_array($data) ? array_values(array_filter($data, 'is_array')) : null;
    }

    private function token(): ?string
    {
        $clientId = $this->clientId();
        $secret = $this->clientSecret();
        if ($clientId === null || $secret === null) {
            return null;
        }
        $cached = Cache::get($this->cacheKey());
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }
        try {
            $response = Http::timeout(15)->acceptJson()->asForm()
                ->post((string) config('services.igdb.token_url', 'https://id.twitch.tv/oauth2/token'), [
                    'client_id' => $clientId,
                    'client_secret' => $secret,
                    'grant_type' => 'client_credentials',
                ]);
        } catch (ConnectionException) {
            return null;
        }
        $token = $response->successful() ? $response->json('access_token') : null;
        if (! is_string($token) || $token === '') {
            return null;
        }
        $ttl = max(60, (int) $response->json('expires_in', 3600) - 600);
        Cache::put($this->cacheKey(), $token, $ttl);

        return $token;
    }

    private function forgetToken(): void
    {
        Cache::forget($this->cacheKey());
    }

    /** Ключ кешу залежить від Client ID — після зміни ключів у адмінці токен береться новий. */
    private function cacheKey(): string
    {
        return 'igdb.token.'.sha1((string) $this->clientId());
    }
}
