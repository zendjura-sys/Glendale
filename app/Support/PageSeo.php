<?php

namespace App\Support;

use App\Models\Clan;
use App\Models\Community;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\Movie;
use App\Models\User;
use App\Services\Seo\OgCards;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Str;

/**
 * Назва, опис, картинка й розмітка schema.org для відкритих сторінок (гра, профіль) —
 * передаються в шаблон через withViewData і потрапляють у <head> для пошуковиків і прев’ю посилань.
 */
class PageSeo
{
    /**
     * @param  array{average: float|null, count: int}|null  $rating  оцінка гравців GameCon
     * @return array<string, mixed>
     */
    public static function game(Game $game, ?array $rating = null): array
    {
        $details = $game->details ?? [];
        $summary = is_string($details['summary'] ?? null) ? trim($details['summary']) : '';
        $platforms = implode(', ', array_map(fn (string $p) => Game::PLATFORMS[$p] ?? $p, $game->platforms ?? []));
        $description = $summary !== ''
            ? Str::limit(preg_replace('/\s+/u', ' ', $summary) ?? $summary, 200)
            : trim($game->name.' на GameCon: тімейти, клани, гайди й оцінка гравців.'.($platforms !== '' ? ' '.$platforms.'.' : ''));

        $entity = array_filter([
            '@type' => 'VideoGame',
            '@id' => route('games.show', $game).'#game',
            'name' => $game->name,
            'url' => route('games.show', $game),
            'description' => $description,
            'image' => $game->cover ?: null,
            'genre' => $game->genres ?: null,
            'gamePlatform' => $platforms !== '' ? explode(', ', $platforms) : null,
            'datePublished' => $game->released?->toDateString(),
            'aggregateRating' => ($rating['average'] ?? null) !== null ? [
                '@type' => 'AggregateRating',
                'ratingValue' => $rating['average'],
                'bestRating' => 10,
                'worstRating' => 1,
                'ratingCount' => $rating['count'],
            ] : null,
        ], fn ($value) => $value !== null);

        return [
            'seoTitle' => $game->name,
            'seoDescription' => $description,
            'seoImage' => $game->cover ?: null,
            'seoEntity' => $entity,
        ];
    }

    /**
     * @param  bool  $open  чи можна показувати «Про себе» (закритий профіль — лише ім’я)
     * @return array<string, mixed>
     */
    public static function profile(User $user, bool $open): array
    {
        $about = $open && is_string($user->about) ? trim($user->about) : '';
        $description = $about !== ''
            ? Str::limit(preg_replace('/\s+/u', ' ', $about) ?? $about, 200)
            : $user->name.' (@'.$user->username.') у GameCon — соцмережі для геймерів.';

        return [
            'seoTitle' => $user->name.' (@'.$user->username.')',
            'seoDescription' => $description,
            'seoImage' => app(Plugins::class)->on('og_cards') ? app(OgCards::class)->profileUrl($user, $open) : ($user->avatar_path ? $user->avatar_url : null),
            'seoImageSize' => app(Plugins::class)->on('og_cards'),
            'seoType' => 'profile',
            'seoEntity' => [
                '@type' => 'ProfilePage',
                '@id' => url('/'.$user->username).'#profile',
                'url' => url('/'.$user->username),
                'mainEntity' => array_filter([
                    '@type' => 'Person',
                    'name' => $user->name,
                    'alternateName' => '@'.$user->username,
                    'image' => $user->avatar_path ? $user->avatar_url : null,
                    'description' => $about !== '' ? $description : null,
                ], fn ($value) => $value !== null),
            ],
        ];
    }

    /**
     * Гостьова сторінка спільноти: назва, опис і картка для прев’ю посилання.
     *
     * @return array<string, mixed>
     */
    public static function community(Community $community): array
    {
        $about = is_string($community->description) ? trim($community->description) : '';
        $cards = app(Plugins::class)->on('og_cards');

        return [
            'seoTitle' => $community->name,
            'seoDescription' => $about !== '' ? Str::limit(preg_replace('/\s+/u', ' ', $about) ?? $about, 200) : $community->name.' — спільнота в GameCon.',
            'seoImage' => $cards ? app(OgCards::class)->communityUrl($community) : $community->avatar_url,
            'seoImageSize' => $cards,
        ];
    }

    /** Короткий опис для мета-тегів: без зайвих пробілів, до 200 символів. */
    private static function brief(?string $text): string
    {
        $text = trim((string) $text);

        return $text === '' ? '' : Str::limit(preg_replace('/\s+/u', ' ', $text) ?? $text, 200);
    }

    /**
     * Тайтл кіно: Movie / TVSeries для пошуковиків.
     *
     * @return array<string, mixed>
     */
    public static function movie(Movie $movie): array
    {
        $url = url('/cinema/'.$movie->slug);
        $kind = Movie::TYPES[$movie->type] ?? 'Фільм';
        $description = self::brief($movie->description) ?: $movie->title.($movie->year ? ' ('.$movie->year.')' : '').' — '.mb_strtolower($kind).' на GameCon: дивіться разом із друзями.';
        $rating = $movie->rating_imdb ?? $movie->rating_tmdb ?? $movie->rating_kp;

        return [
            'seoTitle' => $movie->title.($movie->year ? ' ('.$movie->year.')' : ''),
            'seoDescription' => $description,
            'seoImage' => $movie->backdrop ?: $movie->poster,
            'seoType' => 'video.'.($movie->type === 'movie' ? 'movie' : 'tv_show'),
            'seoEntity' => array_filter([
                '@type' => $movie->type === 'movie' || $movie->type === 'documentary' ? 'Movie' : 'TVSeries',
                '@id' => $url.'#title',
                'name' => $movie->title,
                'alternateName' => $movie->title_original ?: null,
                'url' => $url,
                'description' => $description,
                'image' => $movie->poster ?: null,
                'genre' => array_values(array_filter((array) ($movie->genres ?? []), 'is_string')) ?: null,
                'dateCreated' => $movie->year ? (string) $movie->year : null,
                'contentRating' => $movie->age_rating ?: null,
                'numberOfEpisodes' => $movie->type !== 'movie' && $movie->episodes_count ? $movie->episodes_count : null,
                'aggregateRating' => $rating ? ['@type' => 'AggregateRating', 'ratingValue' => (float) $rating, 'bestRating' => 10, 'worstRating' => 1, 'ratingCount' => 1] : null,
            ], fn ($value) => $value !== null),
        ];
    }

    /**
     * Ігровий сервер: GameServer (онлайн, статус) для пошуковиків.
     *
     * @return array<string, mixed>
     */
    public static function server(GtaServer $server): array
    {
        $url = url('/servers/'.$server->slug);
        $description = self::brief($server->description) ?: self::brief($server->tagline) ?: $server->name.' — сервер GTA на GameCon: онлайн, сім’ї, події й відгуки гравців.';

        return [
            'seoTitle' => $server->name,
            'seoDescription' => $description,
            'seoImage' => $server->icon ?: null,
            'seoEntity' => array_filter([
                '@type' => 'GameServer',
                '@id' => $url.'#server',
                'name' => $server->name,
                'url' => $url,
                'description' => $description,
                'image' => $server->icon ?: null,
                'game' => ['@type' => 'VideoGame', 'name' => 'Grand Theft Auto V'],
                'playersOnline' => $server->players_online,
                'serverStatus' => $server->players_online !== null ? 'Online' : null,
            ], fn ($value) => $value !== null),
        ];
    }

    /**
     * Клан чи гільдія: Organization для пошуковиків.
     *
     * @return array<string, mixed>
     */
    public static function clan(Clan $clan): array
    {
        $url = url('/clans/'.$clan->slug);
        $kind = Clan::TYPES[$clan->type] ?? 'Клан';
        $description = self::brief($clan->description) ?: $kind.' '.$clan->name.' на GameCon: учасники, події, матчі й новини.';

        return [
            'seoTitle' => $clan->name.($clan->tag ? ' ['.$clan->tag.']' : ''),
            'seoDescription' => $description,
            'seoImage' => $clan->logo_url,
            'seoEntity' => array_filter([
                '@type' => 'Organization',
                '@id' => $url.'#clan',
                'name' => $clan->name,
                'alternateName' => $clan->tag ?: null,
                'url' => $url,
                'description' => $description,
                'logo' => $clan->logo_url,
                'numberOfEmployees' => $clan->members_count ? ['@type' => 'QuantitativeValue', 'value' => $clan->members_count] : null,
            ], fn ($value) => $value !== null),
        ];
    }

    /**
     * Сторінка застосунку: MobileApplication з посиланням на магазин.
     *
     * @param  array<string, string>  $links
     * @return array<string, mixed>
     */
    public static function app(array $links, ?string $version): array
    {
        $store = $links['google_play'] ?? null;

        return [
            'seoTitle' => 'Застосунок GameCon для Android',
            'seoDescription' => 'GameCon у телефоні: чати, голос, музика, кіно, сім’ї й сервери GTA — у застосунку для Android.',
            'seoEntity' => array_filter([
                '@type' => 'MobileApplication',
                '@id' => url('/app').'#app',
                'name' => 'GameCon',
                'url' => url('/app'),
                'operatingSystem' => 'Android',
                'applicationCategory' => 'SocialNetworkingApplication',
                'softwareVersion' => $version,
                'downloadUrl' => $store,
                'installUrl' => $store,
                'offers' => ['@type' => 'Offer', 'price' => 0, 'priceCurrency' => 'UAH'],
            ], fn ($value) => $value !== null),
        ];
    }
}
