<?php

namespace App\Support;

use App\Models\Game;
use App\Models\User;
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
            'seoImage' => $user->avatar_path ? $user->avatar_url : null,
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
}
