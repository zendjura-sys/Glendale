<?php

namespace App\Addons;

use App\Models\Addon;
use Illuminate\Support\Facades\Cache;

/**
 * Регистрирует PSR-4 автозагрузку для активных Module/Plugin без
 * composer dump-autoload — так загруженный через админку аддон начинает
 * работать сразу после активации, без пересборки автозагрузчика.
 */
final class AddonAutoloader
{
    /** @var array<int, array{namespace: string, dir: string}> */
    private array $registered = [];

    public function bootActive(): void
    {
        foreach ($this->activeCodeAddons() as $addon) {
            $manifest = AddonManifest::fromArray($addon['manifest']);
            $baseDir = $this->baseDir($addon);

            foreach ($manifest->psr4 as $namespace => $relativeDir) {
                $dir = rtrim($baseDir . '/' . ltrim($relativeDir, '/'), '/');
                if (! is_dir($dir)) {
                    continue;
                }
                $this->registered[] = ['namespace' => $namespace, 'dir' => $dir];
            }
        }

        if ($this->registered === []) {
            return;
        }

        spl_autoload_register(function (string $class): void {
            foreach ($this->registered as $entry) {
                if (! str_starts_with($class, $entry['namespace'])) {
                    continue;
                }
                $relative = substr($class, strlen($entry['namespace']));
                $path = $entry['dir'] . '/' . str_replace('\\', '/', $relative) . '.php';
                if (is_file($path)) {
                    require_once $path;

                    return;
                }
            }
        });
    }

    /**
     * Загружает точки входа активных аддонов для данного контекста
     * (web/admin/bot/api) — просто require нужного routes-файла из
     * манифеста, если он есть.
     */
    public function loadEntrypoint(string $context): void
    {
        foreach ($this->activeCodeAddons() as $addon) {
            $manifest = AddonManifest::fromArray($addon['manifest']);
            $entry = $manifest->entrypoints[$context] ?? null;
            if (! $entry) {
                continue;
            }
            $file = $this->baseDir($addon) . '/' . ltrim($entry, '/');
            if (is_file($file)) {
                require $file;
            }
        }
    }

    /** Вбудовані модулі — з repo (modules/src), завантажені — зі storage. */
    private function baseDir(array $addon): string
    {
        return ! empty($addon['core']) ? $addon['path'] : storage_path('app/' . $addon['path']);
    }

    /**
     * Вбудовані в ядро модулі (CoreModules) + активні завантажені аддони,
     * крім ZIP-копій тих самих вбудованих модулів.
     *
     * @return array<int, array{type:string, slug:string, path:string, manifest:array, core?:bool}>
     */
    private function activeCodeAddons(): array
    {
        $core = array_values(array_map(fn ($m) => [
            'type' => (string) ($m['manifest']['type'] ?? 'module'),
            'slug' => $m['slug'],
            'path' => $m['dir'],
            'manifest' => $m['manifest'],
            'core' => true,
        ], CoreModules::all()));
        $uploaded = array_values(array_filter($this->uploadedAddons(), fn ($a) => ! CoreModules::has($a['slug'])));

        return [...$core, ...$uploaded];
    }

    /**
     * @return array<int, array{type:string, slug:string, path:string, manifest:array}>
     */
    private function uploadedAddons(): array
    {
        // На свежем деплое (до первой миграции) не существует ни таблицы
        // addons, ни, что легко упустить, самой таблицы cache — а
        // CACHE_STORE=database означает, что Cache::remember() тоже бьёт
        // в БД. Оборачиваем весь вызов целиком, а не только запрос внутри
        // него, иначе именно первый artisan-вызов (key:generate) на чистой
        // базе роняет весь деплой.
        try {
            return Cache::remember('addons.active', 300, function () {
                return Addon::query()
                    ->whereIn('type', ['core', 'module', 'plugin', 'union'])
                    ->where('status', 'active')
                    ->get(['type', 'slug', 'path', 'manifest'])
                    ->map(fn ($a) => [
                        'type' => $a->type,
                        'slug' => $a->slug,
                        'path' => $a->path,
                        'manifest' => $a->manifest,
                    ])
                    ->all();
            });
        } catch (\Throwable) {
            return [];
        }
    }
}
