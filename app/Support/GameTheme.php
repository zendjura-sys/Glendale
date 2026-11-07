<?php

namespace App\Support;

use App\Models\Game;
use App\Models\User;
use App\Services\Games\PosterPalette;

/**
 * Тема профілю за улюбленою грою: три кольори з її обкладинки (PosterPalette) фарбують шапку
 * й акценти сторінки людини. Власні кольори GameCon+ мають перевагу.
 */
class GameTheme
{
    public const PREF = 'theme_game';

    public static function game(User $user): ?Game
    {
        $id = $user->pref(self::PREF);

        return is_numeric($id) ? Game::query()->published()->whereKey((int) $id)->first() : null;
    }

    /**
     * Кольори з кешу палітри (рахуються, коли людина вибирає гру) або null.
     *
     * @return list<string>|null
     */
    public static function colors(User $user): ?array
    {
        $game = self::game($user);

        return $game !== null ? self::fromGame($game, false) : null;
    }

    /**
     * @return list<string>|null
     */
    public static function fromGame(Game $game, bool $compute = true): ?array
    {
        $cover = $game->toCard()['cover'] ?? null;
        if (! is_string($cover) || $cover === '') {
            return null;
        }
        $palettes = app(PosterPalette::class);
        $palette = $compute ? $palettes->resolve($cover) : ($palettes->cached($cover) ?: null);
        if ($palette === null) {
            return null;
        }
        $s = $palette['swatches'];

        return [
            $s['vibrant'] ?? $palette['accent'],
            $s['light_vibrant'] ?? $s['light_muted'] ?? $palette['soft'],
            $s['dark_vibrant'] ?? $s['muted'] ?? $palette['accent'],
        ];
    }
}
