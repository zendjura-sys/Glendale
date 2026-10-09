<?php

namespace App\Services\Games;

/**
 * Перетворює запис IGDB на дані каталогу: жанри й режими українською, мультиплеєр, рейтинги,
 * медіа, компанії, вікові рейтинги, дати виходу, мови й посилання спільноти.
 */
class IgdbMapper
{
    /** Жанри IGDB (id) → назви каталогу (ті самі, що в стартовому списку). */
    public const GENRES = [
        2 => 'Point-and-click', 4 => 'Файтинг', 5 => 'Шутер', 7 => 'Музична', 8 => 'Платформер', 9 => 'Головоломка',
        10 => 'Перегони', 11 => 'Стратегія в реальному часі', 12 => 'RPG', 13 => 'Симулятор', 14 => 'Спорт', 15 => 'Стратегія',
        16 => 'Покрокова стратегія', 24 => 'Тактика', 25 => 'Слешер', 26 => 'Вікторина', 30 => 'Пінбол', 31 => 'Пригоди',
        32 => 'Інді', 33 => 'Аркада', 34 => 'Візуальна новела', 35 => 'Карти', 36 => 'MOBA',
    ];

    /** Теми IGDB (id) → назви. 42 (еротика) відсікається ще в запиті. */
    public const THEMES = [
        1 => 'Екшн', 17 => 'Фентезі', 18 => 'Наукова фантастика', 19 => 'Хорор', 20 => 'Трилер', 21 => 'Виживання',
        22 => 'Історична', 23 => 'Стелс', 27 => 'Комедія', 28 => 'Бізнес', 31 => 'Драма', 32 => 'Документальна',
        33 => 'Пісочниця', 34 => 'Освітня', 35 => 'Дитяча', 38 => 'Відкритий світ', 39 => 'Війна', 40 => 'Пати',
        41 => '4X', 43 => 'Детектив', 44 => 'Романтика',
    ];

    /** Ігрові режими IGDB (id) → ключі Game::MODES. */
    public const MODES = [1 => 'single', 2 => 'multiplayer', 3 => 'coop', 4 => 'split_screen', 5 => 'mmo', 6 => 'battle_royale'];

    public const PERSPECTIVES = [
        1 => 'Від першої особи', 2 => 'Від третьої особи', 3 => 'Ізометрія / згори', 4 => 'Вид збоку',
        5 => 'Текстова', 6 => 'Аудіо', 7 => 'Віртуальна реальність',
    ];

    /** Вікові рейтинги: організація IGDB → назва, рейтинг → позначка. */
    private const AGE_ORGS = [1 => 'ESRB', 2 => 'PEGI'];

    private const AGE_RATINGS = [1 => '3', 2 => '7', 3 => '12', 4 => '16', 5 => '18', 6 => 'RP', 7 => 'EC', 8 => 'E', 9 => 'E10+', 10 => 'T', 11 => 'M', 12 => 'AO'];

    private const LANGUAGES = [
        'Ukrainian' => 'Українська', 'English' => 'Англійська', 'Polish' => 'Польська', 'German' => 'Німецька', 'French' => 'Французька',
        'Spanish (Spain)' => 'Іспанська', 'Spanish (Mexico)' => 'Іспанська (Мексика)', 'Italian' => 'Італійська', 'Portuguese (Brazil)' => 'Португальська (Бразилія)',
        'Portuguese (Portugal)' => 'Португальська', 'Japanese' => 'Японська', 'Korean' => 'Корейська', 'Chinese (Simplified)' => 'Китайська (спрощена)',
        'Chinese (Traditional)' => 'Китайська (традиційна)', 'Turkish' => 'Турецька', 'Czech' => 'Чеська', 'Russian' => 'Російська', 'Arabic' => 'Арабська',
        'Thai' => 'Тайська', 'Dutch' => 'Нідерландська', 'Swedish' => 'Шведська', 'Hungarian' => 'Угорська', 'Romanian' => 'Румунська',
    ];

    /** Сайти спільноти за доменом. */
    private const SOCIAL = [
        'discord.gg' => 'discord', 'discord.com' => 'discord', 'twitch.tv' => 'twitch', 'youtube.com' => 'youtube', 'youtu.be' => 'youtube',
        'reddit.com' => 'reddit', 'x.com' => 'twitter', 'twitter.com' => 'twitter', 'facebook.com' => 'facebook', 'instagram.com' => 'instagram',
        'tiktok.com' => 'tiktok', 'vk.com' => 'vk', 'wikipedia.org' => 'wikipedia', 'fandom.com' => 'wiki', 't.me' => 'telegram',
    ];

    public const SOCIAL_LABELS = [
        'official' => 'Офіційний сайт', 'discord' => 'Discord', 'twitch' => 'Twitch', 'youtube' => 'YouTube', 'reddit' => 'Reddit',
        'twitter' => 'X (Twitter)', 'facebook' => 'Facebook', 'instagram' => 'Instagram', 'tiktok' => 'TikTok', 'vk' => 'VK',
        'wikipedia' => 'Вікіпедія', 'wiki' => 'Вікі гри', 'telegram' => 'Telegram',
    ];

    /**
     * @param  array<string, mixed>  $row
     * @return array{platforms: list<string>, genres: list<string>, modes: list<string>, aliases: string|null, links: array<string, array{store: string, url: string}>, cover: string|null, released: string|null, rating: float|null, popularity: int, details: array<string, mixed>}
     */
    public static function map(array $row): array
    {
        $ids = fn (string $key): array => array_values(array_filter(array_map(fn ($v) => is_numeric($v) ? (int) $v : (is_array($v) && is_numeric($v['id'] ?? null) ? (int) $v['id'] : 0), self::list($row[$key] ?? null))));
        $names = fn (string $key): array => array_values(array_unique(array_filter(array_map(fn ($v) => is_array($v) && is_string($v['name'] ?? null) ? trim($v['name']) : '', self::list($row[$key] ?? null)))));

        $platforms = [];
        foreach ($ids('platforms') as $id) {
            if (isset(Igdb::PLATFORMS[$id])) {
                $platforms[Igdb::PLATFORMS[$id]] = Igdb::PLATFORMS[$id];
            }
        }
        $genres = array_values(array_unique([
            ...array_map(fn (int $id) => self::GENRES[$id] ?? '', $ids('genres')),
            ...array_map(fn (int $id) => self::THEMES[$id] ?? '', array_intersect($ids('themes'), [1, 19, 21, 33, 38, 40])),
        ]));
        $modes = array_values(array_unique(array_filter(array_map(fn (int $id) => self::MODES[$id] ?? null, $ids('game_modes')))));

        [$links, $websites] = self::websites($row);

        $developers = $publishers = [];
        foreach (self::list($row['involved_companies'] ?? null) as $c) {
            $name = is_array($c) && is_array($c['company'] ?? null) && is_string($c['company']['name'] ?? null) ? $c['company']['name'] : null;
            if ($name === null) {
                continue;
            }
            if (! empty($c['developer'])) {
                $developers[] = $name;
            }
            if (! empty($c['publisher'])) {
                $publishers[] = $name;
            }
        }

        $images = fn (string $key, string $size, int $limit): array => array_slice(array_values(array_filter(array_map(
            fn ($v) => is_array($v) && is_string($v['image_id'] ?? null) ? Igdb::image($v['image_id'], $size) : null,
            self::list($row[$key] ?? null),
        ))), 0, $limit);
        $videos = [];
        foreach (self::list($row['videos'] ?? null) as $v) {
            $id = is_array($v) && is_string($v['video_id'] ?? null) ? $v['video_id'] : '';
            if (preg_match('/^[A-Za-z0-9_-]{6,20}$/', $id) === 1) {
                $videos[] = ['id' => $id, 'name' => is_string($v['name'] ?? null) ? $v['name'] : 'Трейлер'];
            }
        }

        $total = is_numeric($row['total_rating'] ?? null) ? (float) $row['total_rating'] : null;
        $cover = is_array($row['cover'] ?? null) && is_string($row['cover']['image_id'] ?? null) ? Igdb::cover($row['cover']['image_id']) : null;
        $aliases = $names('alternative_names');

        return [
            'platforms' => array_values($platforms),
            'genres' => array_slice(array_values(array_filter($genres)), 0, 6),
            'modes' => $modes,
            'aliases' => $aliases === [] ? null : mb_substr(implode(' | ', $aliases), 0, 2000),
            'links' => $links,
            'cover' => $cover,
            'released' => is_numeric($row['first_release_date'] ?? null) ? gmdate('Y-m-d', (int) $row['first_release_date']) : null,
            'rating' => $total !== null ? round($total / 20, 2) : null,
            'popularity' => (int) ($row['total_rating_count'] ?? 0) * 5 + (int) ($row['hypes'] ?? 0),
            'details' => array_filter([
                'summary' => self::text($row['summary'] ?? null, 4000),
                'storyline' => self::text($row['storyline'] ?? null, 6000),
                'screenshots' => $images('screenshots', 'screenshot_big', 12),
                'artworks' => $images('artworks', '1080p', 6),
                'videos' => array_slice($videos, 0, 6),
                'developers' => array_values(array_unique($developers)),
                'publishers' => array_values(array_unique($publishers)),
                'engines' => $names('game_engines'),
                'franchises' => array_values(array_unique([...$names('franchises'), ...$names('collections')])),
                'themes' => array_values(array_filter(array_map(fn (int $id) => self::THEMES[$id] ?? null, $ids('themes')))),
                'perspectives' => array_values(array_filter(array_map(fn (int $id) => self::PERSPECTIVES[$id] ?? null, $ids('player_perspectives')))),
                'multiplayer' => self::multiplayer($row),
                'age_ratings' => self::ageRatings($row),
                'release_dates' => self::releaseDates($row),
                'languages' => self::languages($row),
                'websites' => $websites,
                'ratings' => array_filter([
                    'critics' => self::score($row['aggregated_rating'] ?? null),
                    'critics_count' => (int) ($row['aggregated_rating_count'] ?? 0) ?: null,
                    'players' => self::score($row['rating'] ?? null),
                    'players_count' => (int) ($row['rating_count'] ?? 0) ?: null,
                    'total' => self::score($total),
                    'total_count' => (int) ($row['total_rating_count'] ?? 0) ?: null,
                ], fn ($v) => $v !== null),
                'hypes' => (int) ($row['hypes'] ?? 0) ?: null,
                'similar' => array_slice($ids('similar_games'), 0, 16),
                'igdb_url' => is_string($row['url'] ?? null) && str_starts_with($row['url'], 'https://www.igdb.com/') ? $row['url'] : null,
            ], fn ($v) => $v !== null && $v !== [] && $v !== ''),
        ];
    }

    /**
     * Магазини йдуть у кнопки «Грати», решта — у «Спільноту».
     *
     * @param  array<string, mixed>  $row
     * @return array{0: array<string, array{store: string, url: string}>, 1: list<array{kind: string, label: string, url: string}>}
     */
    private static function websites(array $row): array
    {
        $stores = $social = [];
        foreach (self::list($row['websites'] ?? null) as $w) {
            $url = is_array($w) && is_string($w['url'] ?? null) ? trim($w['url']) : '';
            if (! str_starts_with($url, 'https://') && ! str_starts_with($url, 'http://')) {
                continue;
            }
            $url = preg_replace('#^http://#', 'https://', $url) ?? $url;
            $store = Igdb::storeOf($url);
            if ($store !== null) {
                $stores[$store] ??= ['store' => $store, 'url' => $url];

                continue;
            }
            $host = preg_replace('/^(www|m|en|uk)\./', '', strtolower((string) parse_url($url, PHP_URL_HOST))) ?? '';
            $kind = 'official';
            foreach (self::SOCIAL as $domain => $k) {
                if ($host === $domain || str_ends_with($host, '.'.$domain)) {
                    $kind = $k;
                    break;
                }
            }
            if (! isset($social[$kind])) {
                $social[$kind] = ['kind' => $kind, 'label' => self::SOCIAL_LABELS[$kind], 'url' => $url];
            }
        }

        return [$stores, array_values($social)];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, int|bool>
     */
    private static function multiplayer(array $row): array
    {
        $out = [];
        $max = ['onlinemax' => 'online_max', 'offlinemax' => 'offline_max', 'onlinecoopmax' => 'online_coop_max', 'offlinecoopmax' => 'offline_coop_max'];
        $flags = ['onlinecoop' => 'online_coop', 'offlinecoop' => 'offline_coop', 'lancoop' => 'lan', 'campaigncoop' => 'campaign_coop', 'splitscreen' => 'split_screen', 'dropin' => 'drop_in'];
        foreach (self::list($row['multiplayer_modes'] ?? null) as $m) {
            if (! is_array($m)) {
                continue;
            }
            foreach ($max as $from => $to) {
                if (is_numeric($m[$from] ?? null) && (int) $m[$from] > 0) {
                    $out[$to] = max((int) $m[$from], (int) ($out[$to] ?? 0));
                }
            }
            foreach ($flags as $from => $to) {
                if (! empty($m[$from])) {
                    $out[$to] = true;
                }
            }
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $row
     * @return list<string>
     */
    private static function ageRatings(array $row): array
    {
        $out = [];
        foreach (self::list($row['age_ratings'] ?? null) as $a) {
            if (! is_array($a)) {
                continue;
            }
            $org = self::AGE_ORGS[(int) ($a['organization'] ?? $a['category'] ?? 0)] ?? null;
            $rating = self::AGE_RATINGS[(int) ($a['rating_category'] ?? $a['rating'] ?? 0)] ?? null;
            if ($org !== null && $rating !== null) {
                $out[$org] = $org.' '.$rating;
            }
        }
        ksort($out);

        return array_values($out);
    }

    /**
     * @param  array<string, mixed>  $row
     * @return list<array{platform: string, date: string}>
     */
    private static function releaseDates(array $row): array
    {
        $out = [];
        foreach (self::list($row['release_dates'] ?? null) as $r) {
            $platform = is_array($r) ? Igdb::PLATFORMS[(int) ($r['platform'] ?? 0)] ?? null : null;
            $date = is_array($r) && is_numeric($r['date'] ?? null) ? gmdate('Y-m-d', (int) $r['date']) : null;
            if ($platform !== null && $date !== null && (! isset($out[$platform]) || $date < $out[$platform])) {
                $out[$platform] = $date;
            }
        }
        asort($out);

        return array_map(fn (string $p, string $d) => ['platform' => $p, 'date' => $d], array_keys($out), array_values($out));
    }

    /**
     * Мови з типом підтримки; українська — першою.
     *
     * @param  array<string, mixed>  $row
     * @return list<array{name: string, audio: bool, subtitles: bool, interface: bool}>
     */
    private static function languages(array $row): array
    {
        $out = [];
        foreach (self::list($row['language_supports'] ?? null) as $l) {
            $name = is_array($l) && is_array($l['language'] ?? null) && is_string($l['language']['name'] ?? null) ? $l['language']['name'] : null;
            if ($name === null) {
                continue;
            }
            $out[$name] ??= ['name' => self::LANGUAGES[$name] ?? $name, 'audio' => false, 'subtitles' => false, 'interface' => false];
            $type = (int) ($l['language_support_type'] ?? 0);
            $key = [1 => 'audio', 2 => 'subtitles', 3 => 'interface'][$type] ?? null;
            if ($key !== null) {
                $out[$name][$key] = true;
            }
        }
        uksort($out, fn (string $a, string $b) => [$a !== 'Ukrainian', $a !== 'English', $a] <=> [$b !== 'Ukrainian', $b !== 'English', $b]);

        return array_slice(array_values($out), 0, 40);
    }

    private static function score(mixed $value): ?int
    {
        return is_numeric($value) && $value > 0 ? (int) round((float) $value) : null;
    }

    private static function text(mixed $value, int $limit): ?string
    {
        return is_string($value) && trim($value) !== '' ? mb_substr(trim($value), 0, $limit) : null;
    }

    /**
     * @return list<mixed>
     */
    private static function list(mixed $value): array
    {
        return is_array($value) ? array_values($value) : [];
    }
}
