<?php

namespace App\Support\Plugins;

use App\Models\User;
use App\Services\Geo\CountryRestrictions;
use App\Support\Modules\ModuleManager;
use App\Support\NetworkModes;
use App\Support\Settings\SiteSettings;

/**
 * Інтегровані функції сайту. Меню ними не керує: для розділів є модулі.
 *
 * Кожна функція належить розділу (модулю): за групою в config/plugins.php або явним 'module'.
 * Немає розділу на сайті чи в режимі людини («Класика» без ігор, «Мінімал»…) — немає й функції:
 * ні кнопок, ні блоків, ні згадок. Функція може залежати й від можливості режиму ('feature': історії…).
 */
class Plugins
{
    /** Розділ функції за групою, якщо в config/plugins.php не вказано 'module'. */
    private const GROUP_MODULES = [
        'Кіно' => 'cinema',
        'Музика' => 'music',
        'Сервери' => 'servers',
        'Ігри' => 'games',
        'Сім’ї' => 'families',
        'Чати' => 'messages',
    ];

    public function __construct(private readonly SiteSettings $settings) {}

    /**
     * Функція доступна зараз: увімкнена на сайті, не закрита для країни, а її розділ і можливість
     * є і на сайті, і в режимі людини, що зайшла (у фонових задачах — лише налаштування сайту).
     */
    public function on(string $key): bool
    {
        $item = $this->find($key);
        if ($item === null) {
            return false;
        }

        // Функцію вимкнено для країни відвідувача (Адмінка → Країни → Обмеження).
        if (! $this->onSite($key) || app(CountryRestrictions::class)->pluginBlocked($key)) {
            return false;
        }
        if ($item['module'] !== null && ! app(ModuleManager::class)->enabled($item['module'])) {
            return false;
        }
        $user = self::viewer();
        if ($user === null) {
            return true;
        }
        $mode = app(NetworkModes::class)->for($user);
        if (in_array($key, $mode['plugins_off'], true)) {
            return false;
        }

        return $item['feature'] === null || ($mode['features'][$item['feature']] ?? true);
    }

    /** Увімкнено адміністратором для всього сайту (без режиму людини й країни) — для адмінки. */
    public function onForSite(string $key): bool
    {
        return $this->find($key) !== null && $this->onSite($key);
    }

    /** Людина поточного запиту (сайт чи застосунок); у консолі й черзі — ніхто. */
    public static function viewer(): ?User
    {
        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            return null;
        }
        $user = request()->user() ?? auth()->user();

        return $user instanceof User ? $user : null;
    }

    public function ensure(string $key): void
    {
        if ($this->find($key) !== null && $this->onSite($key) && app(CountryRestrictions::class)->pluginBlocked($key)) {
            abort(403, CountryRestrictions::MESSAGE);
        }
        abort_unless($this->on($key), 404);
    }

    /** Увімкнено для всього сайту (без урахування країни). */
    private function onSite(string $key): bool
    {
        $stored = $this->settings->get('plugins');
        if (! is_array($stored) || ! array_key_exists($key, $stored)) {
            return true;
        }

        return (bool) $stored[$key];
    }

    public function set(string $key, bool $enabled): void
    {
        abort_unless($this->find($key) !== null, 404);
        $stored = $this->settings->get('plugins');
        $stored = is_array($stored) ? $stored : [];
        $stored[$key] = $enabled;
        $this->settings->put(['plugins' => $stored]);
    }

    /**
     * Ключі всіх функцій (без перевірки стану) — для налаштувань режимів.
     *
     * @return list<string>
     */
    public function keys(): array
    {
        return array_column($this->items(), 'key');
    }

    /**
     * @return array<string, bool>
     */
    public function flags(): array
    {
        $flags = [];
        foreach ($this->items() as $item) {
            $flags[$item['key']] = $this->on($item['key']);
        }

        return $flags;
    }

    /**
     * @return list<array{key: string, group: string, name: string, description: string, enabled: bool}>
     */
    public function catalog(): array
    {
        return array_map(fn (array $item) => [
            'key' => $item['key'], 'group' => $item['group'], 'name' => $item['name'], 'description' => $item['description'],
            'enabled' => $this->onForSite($item['key']),
        ], $this->items());
    }

    /**
     * @return list<array{key: string, group: string, name: string, description: string, module: string|null, feature: string|null}>
     */
    private function items(): array
    {
        $items = config('plugins');
        $out = [];
        foreach (is_array($items) ? $items : [] as $item) {
            if (is_array($item) && is_string($item['key'] ?? null) && is_string($item['group'] ?? null) && is_string($item['name'] ?? null) && is_string($item['description'] ?? null)) {
                $module = array_key_exists('module', $item) ? $item['module'] : (self::GROUP_MODULES[$item['group']] ?? null);
                $out[] = [
                    'key' => $item['key'], 'group' => $item['group'], 'name' => $item['name'], 'description' => $item['description'],
                    'module' => is_string($module) ? $module : null,
                    'feature' => is_string($item['feature'] ?? null) ? $item['feature'] : null,
                ];
            }
        }

        return $out;
    }

    /**
     * @return array{key: string, group: string, name: string, description: string, module: string|null, feature: string|null}|null
     */
    private function find(string $key): ?array
    {
        foreach ($this->items() as $item) {
            if ($item['key'] === $key) {
                return $item;
            }
        }

        return null;
    }
}
