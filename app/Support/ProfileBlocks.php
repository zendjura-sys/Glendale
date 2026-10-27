<?php

namespace App\Support;

use App\Support\Modules\ModuleManager;

class ProfileBlocks
{
    /** @var list<string> */
    public const ORDER = ['platforms', 'steam', 'steam_achievements', 'setup', 'games', 'about', 'achievements', 'audio', 'friends', 'photos', 'characters'];

    /** Блоки, що належать розділу: без розділу в режимі глядача їх не видно (порядок зберігається). */
    public const MODULES = ['platforms' => 'games', 'steam' => 'games', 'steam_achievements' => 'games', 'games' => 'games', 'audio' => 'music', 'photos' => 'photos', 'characters' => 'servers'];

    /**
     * Збережений порядок лише з блоками, розділи яких є в режимі глядача.
     *
     * @return list<string>
     */
    public static function visible(mixed $stored): array
    {
        $modules = app(ModuleManager::class);

        return array_values(array_filter(self::normalize($stored), fn (string $key) => ! isset(self::MODULES[$key]) || $modules->enabled(self::MODULES[$key])));
    }

    /**
     * @return list<string>
     */
    public static function normalize(mixed $stored): array
    {
        $picked = [];
        if (is_array($stored)) {
            foreach ($stored as $key) {
                if (is_string($key) && in_array($key, self::ORDER, true) && ! in_array($key, $picked, true)) {
                    $picked[] = $key;
                }
            }
        }
        foreach (self::ORDER as $key) {
            if (! in_array($key, $picked, true)) {
                $picked[] = $key;
            }
        }

        return $picked;
    }

    /**
     * Новий порядок видимих блоків, а приховані режимом лишаються на своїх місцях.
     *
     * @return list<string>
     */
    public static function merge(mixed $stored, mixed $visible): array
    {
        $old = self::normalize($stored);
        $allowed = self::visible($stored);
        $shown = array_values(array_filter(self::normalize($visible), fn (string $key) => in_array($key, $allowed, true)));
        $result = [];
        foreach ($old as $key) {
            $result[] = in_array($key, $allowed, true) ? array_shift($shown) : $key;
        }

        return self::normalize($result);
    }
}
