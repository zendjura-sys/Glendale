<?php

namespace App\Support\Modules;

use App\Models\Module;
use App\Models\User;
use App\Services\Geo\CountryRestrictions;
use App\Support\NetworkModes;
use App\Support\Plugins\Plugins;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use InvalidArgumentException;

class ModuleManager
{
    private const CACHE_KEY = 'modules.state';

    /** @var array<string, bool>|null */
    private ?array $state = null;

    /**
     * @param  array<string, array<string, mixed>>  $definitions
     */
    public function __construct(private readonly array $definitions) {}

    /** @var array<string, list<string>> Розділи режиму людини за запит (ключ — id і режим). */
    private array $modeModules = [];

    /**
     * @return Collection<string, array{key: string, name: string, description: string, icon: string, core: bool, available: bool, enabled: bool, nav: array{label: string, route: string, position: int}|null}>
     */
    public function all(): Collection
    {
        $state = $this->state();

        return collect($this->definitions)
            ->map(function (array $definition, string $key) use ($state): array {
                $name = $definition['name'] ?? null;
                $description = $definition['description'] ?? '';
                $icon = $definition['icon'] ?? 'box';

                return [
                    'key' => $key,
                    'name' => is_string($name) ? $name : $key,
                    'description' => is_string($description) ? $description : '',
                    'icon' => is_string($icon) ? $icon : 'box',
                    'core' => (bool) ($definition['core'] ?? false),
                    'available' => (bool) ($definition['available'] ?? true),
                    'enabled' => $this->resolveEnabled($key, $definition, $state),
                    'nav' => $this->navigationItem($definition['nav'] ?? null),
                ];
            });
    }

    public function exists(string $key): bool
    {
        return array_key_exists($key, $this->definitions);
    }

    /**
     * Розділ доступний зараз: увімкнений на сайті й є в режимі людини, що зайшла («Класика» —
     * без ігор і кіно, «Мінімал»…). Без людини (гість, фонова задача) — лише налаштування сайту.
     */
    public function enabled(string $key): bool
    {
        if (! $this->enabledForSite($key)) {
            return false;
        }
        $user = Plugins::viewer();
        if ($user === null) {
            return true;
        }
        // Розділи режиму — один раз на запит (країна відвідувача теж впливає) для людини й її режиму.
        $memo = spl_object_id(request()).'|'.$user->id.'|'.(string) $user->pref('network_mode');
        $this->modeModules[$memo] ??= app(NetworkModes::class)->modulesFor($user);

        return in_array($key, $this->modeModules[$memo], true);
    }

    /** Розділ увімкнено для всього сайту (без режиму людини) — для адмінки й рішень за інших людей. */
    public function enabledForSite(string $key): bool
    {
        if (! $this->exists($key)) {
            return false;
        }

        return $this->resolveEnabled($key, $this->definitions[$key], $this->state());
    }

    /** Розділ увімкнено на сайті, але закрито для країни відвідувача. */
    public function blockedByCountry(string $key): bool
    {
        return $this->exists($key) && ! ($this->definitions[$key]['core'] ?? false)
            && $this->enabledOnSite($key, $this->definitions[$key], $this->state())
            && app(CountryRestrictions::class)->moduleBlocked($key);
    }

    public function set(string $key, bool $enabled): void
    {
        if (! $this->exists($key)) {
            throw new InvalidArgumentException("Unknown module [{$key}].");
        }

        $definition = $this->definitions[$key];

        if (($definition['core'] ?? false) && ! $enabled) {
            throw new InvalidArgumentException("Core module [{$key}] cannot be disabled.");
        }

        if (! ($definition['available'] ?? true) && $enabled) {
            throw new InvalidArgumentException("Module [{$key}] is not available yet.");
        }

        Module::query()->updateOrCreate(['key' => $key], ['enabled' => $enabled]);

        $this->flush();
    }

    /**
     * Пункти лівого меню для увімкнених модулів, відсортовані за позицією.
     *
     * @return list<array{key: string, label: string, icon: string, href: string}>
     */
    public function navigation(): array
    {
        $items = [];
        foreach ($this->all()->sortBy(fn (array $module): int => is_array($module['nav']) ? $module['nav']['position'] : PHP_INT_MAX) as $module) {
            $nav = $module['nav'];
            if (! $module['enabled'] || $nav === null || ! Route::has($nav['route'])) {
                continue;
            }
            $items[] = [
                'key' => $module['key'],
                'label' => $nav['label'],
                'icon' => $module['icon'],
                'href' => route($nav['route'], absolute: false),
            ];
        }

        return $items;
    }

    /**
     * Розділи нижньої панелі користувача: його вибір без вимкнених модулів, інакше типові.
     *
     * @return list<string>
     */
    public function navTabsFor(User $user): array
    {
        $available = array_column($this->navigation(), 'key');
        $pick = fn (array $keys): array => array_slice(array_values(array_unique(array_intersect($keys, $available))), 0, User::MAX_NAV);

        $chosen = $pick(is_array($user->nav_tabs) ? $user->nav_tabs : []);

        return $chosen !== [] ? $chosen : $pick(User::DEFAULT_NAV);
    }

    /**
     * @return list<string>
     */
    public function enabledKeys(): array
    {
        return array_values($this->all()->filter(fn (array $module) => $module['enabled'])->keys()->all());
    }

    public function flush(): void
    {
        $this->state = null;
        $this->modeModules = [];
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * @return array<string, bool>
     */
    private function state(): array
    {
        return $this->state ??= Cache::rememberForever(
            self::CACHE_KEY,
            fn () => Module::query()->pluck('enabled', 'key')->map(fn ($value) => (bool) $value)->all(),
        );
    }

    /**
     * @return array{label: string, route: string, position: int}|null
     */
    private function navigationItem(mixed $nav): ?array
    {
        if (! is_array($nav) || ! isset($nav['label'], $nav['route']) || ! is_string($nav['label']) || ! is_string($nav['route'])) {
            return null;
        }

        $position = $nav['position'] ?? 0;

        return [
            'label' => $nav['label'],
            'route' => $nav['route'],
            'position' => is_int($position) ? $position : (is_numeric($position) ? (int) $position : 0),
        ];
    }

    /**
     * @param  array<string, mixed>  $definition
     * @param  array<string, bool>  $state
     */
    private function resolveEnabled(string $key, array $definition, array $state): bool
    {
        if ($definition['core'] ?? false) {
            return (bool) ($definition['available'] ?? true);
        }

        // Розділ вимкнено для країни відвідувача (Адмінка → Країни → Обмеження).
        return $this->enabledOnSite($key, $definition, $state) && ! app(CountryRestrictions::class)->moduleBlocked($key);
    }

    /**
     * Стан для всього сайту, без урахування країни відвідувача.
     *
     * @param  array<string, mixed>  $definition
     * @param  array<string, bool>  $state
     */
    private function enabledOnSite(string $key, array $definition, array $state): bool
    {
        if (! ($definition['available'] ?? true)) {
            return false;
        }

        if ($definition['core'] ?? false) {
            return true;
        }

        return $state[$key] ?? (bool) ($definition['default'] ?? true);
    }
}
