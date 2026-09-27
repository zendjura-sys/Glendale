<?php

namespace App\Addons;

use InvalidArgumentException;

/**
 * Разобранный и провалидированный manifest.json аддона.
 *
 * Манифест — единственный источник истины о том, что за пакет загружен:
 * его тип, версия, точки входа и т.д. Ничего из этого не выводится
 * из имени файла или пользовательского ввода в форме.
 */
final class AddonManifest
{
    /*
     * Тип theme (Design-пакет) убран: оформление настраивается в админке
     * (раздел «Дизайн»), а не ставится архивом. Для сайта на Vue 3 со
     * сборкой через Vite тема в ZIP всё равно не могла влезть в
     * скомпилированные компоненты — она умела лишь подложить свои css/js
     * рядом, то есть держать второе, несогласованное оформление.
     *
     * union — окрема гілка аддонів для union.gamecon.online: той самий
     * формат пакета й той самий AddonInstaller (перевірена логіка
     * ZIP/маніфесту не дублюється), але встановлює й активує їх лише
     * Admin\UnionAddonController під правом union.manage — незалежно
     * від "Аддони" (addons.manage) в основній адмінці. Код union-аддона
     * так само вантажиться в рантайм (AddonAutoloader), тож маршрути
     * з entrypoints.web самі відповідають за Route::domain($unionDomain),
     * як і роут головної union.gamecon.online у routes/web.php.
     */
    public const TYPES = ['core', 'module', 'plugin', 'union'];

    public function __construct(
        public readonly string $type,
        public readonly string $slug,
        public readonly string $name,
        public readonly string $version,
        public readonly ?string $description,
        public readonly ?string $minCoreVersion,
        public readonly array $entrypoints,
        public readonly ?string $migrationsPath,
        public readonly ?string $assetsPath,
        public readonly array $psr4,
        public readonly array $raw,
    ) {
    }

    /**
     * @throws InvalidArgumentException с человекочитаемым текстом ошибки —
     * он же уйдёт в поле errors AJAX-ответа.
     */
    public static function fromArray(array $data): self
    {
        $type = (string) ($data['type'] ?? '');
        if (! in_array($type, self::TYPES, true)) {
            throw new InvalidArgumentException(
                'manifest.type должен быть одним из: ' . implode(', ', self::TYPES)
            );
        }

        $slug = (string) ($data['slug'] ?? '');
        if (! preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug)) {
            throw new InvalidArgumentException(
                'manifest.slug должен быть в формате "lower-kebab-case" (a-z, 0-9, дефис)'
            );
        }

        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            throw new InvalidArgumentException('manifest.name обязателен');
        }

        $version = (string) ($data['version'] ?? '');
        if (! preg_match('/^\d+\.\d+\.\d+$/', $version)) {
            throw new InvalidArgumentException(
                'manifest.version должен быть в формате x.y.z (например 1.2.0)'
            );
        }

        $entrypoints = $data['entrypoints'] ?? [];
        if (! is_array($entrypoints)) {
            throw new InvalidArgumentException('manifest.entrypoints должен быть объектом');
        }
        $allowedEntrypoints = ['web', 'admin', 'bot', 'api', 'events'];
        foreach (array_keys($entrypoints) as $key) {
            if (! in_array($key, $allowedEntrypoints, true)) {
                throw new InvalidArgumentException(
                    "manifest.entrypoints.$key недопустим (разрешены: " . implode(', ', $allowedEntrypoints) . ')'
                );
            }
        }

        $psr4 = [];
        {
            $psr4 = $data['autoload']['psr4'] ?? [];
            if (! is_array($psr4)) {
                throw new InvalidArgumentException('manifest.autoload.psr4 должен быть объектом');
            }
            foreach ($psr4 as $namespace => $path) {
                if (! preg_match('/^[A-Za-z0-9_\\\\]+\\\\$/', $namespace)) {
                    throw new InvalidArgumentException("Некорректное пространство имён autoload: $namespace");
                }
            }
        }

        return new self(
            type: $type,
            slug: $slug,
            name: $name,
            version: $version,
            description: isset($data['description']) ? (string) $data['description'] : null,
            minCoreVersion: isset($data['min_core_version']) ? (string) $data['min_core_version'] : null,
            entrypoints: $entrypoints,
            migrationsPath: isset($data['migrations']) ? (string) $data['migrations'] : null,
            assetsPath: isset($data['assets']) ? (string) $data['assets'] : null,
            psr4: $psr4,
            raw: $data,
        );
    }

    public function packageLabel(): string
    {
        return self::labelForType($this->type);
    }

    public static function labelForType(string $type): string
    {
        return match ($type) {
            'core' => 'Core',
            'module' => 'Modules',
            'plugin' => 'Plugin',
            'union' => 'Union',
            default => $type,
        };
    }
}
