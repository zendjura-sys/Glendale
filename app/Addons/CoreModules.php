<?php

namespace App\Addons;

/**
 * Модулі, вбудовані в ядро: система родин (звіти, банк, покарання, цілі,
 * події, прогресія, кадри, розсилки, Telegram, месенджер, сповіщення, AI).
 * Код лежить у репозиторії (modules/src), завжди ввімкнений і оновлюється
 * разом із сайтом звичайним деплоєм; міграції — звичайний `migrate`.
 * Завантажені колись ZIP-копії тих самих модулів (storage/app/addons)
 * більше не підключаються — інакше код ішов би двічі.
 */
final class CoreModules
{
    /** @var array<string, array{slug:string, dir:string, manifest:array}>|null */
    private static ?array $cache = null;

    /** @return array<string, array{slug:string, dir:string, manifest:array}> */
    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }
        $out = [];
        foreach (glob(base_path('modules/src/*/manifest.json')) ?: [] as $file) {
            $manifest = json_decode((string) file_get_contents($file), true);
            if (! is_array($manifest) || empty($manifest['slug'])) {
                continue;
            }
            $out[$manifest['slug']] = ['slug' => $manifest['slug'], 'dir' => dirname($file), 'manifest' => $manifest];
        }

        return self::$cache = $out;
    }

    /** @return list<string> */
    public static function slugs(): array
    {
        return array_keys(self::all());
    }

    public static function has(string $slug): bool
    {
        return isset(self::all()[$slug]);
    }

    /** @return list<string> */
    public static function migrationPaths(): array
    {
        $paths = [];
        foreach (self::all() as $module) {
            $dir = $module['dir'].'/'.ltrim((string) ($module['manifest']['migrations'] ?? 'migrations'), '/');
            if (is_dir($dir)) {
                $paths[] = $dir;
            }
        }

        return $paths;
    }
}
