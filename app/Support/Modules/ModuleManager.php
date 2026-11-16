<?php

namespace App\Support\Modules;

use App\Models\Module;
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

    /**
     * @return Collection<string, array<string, mixed>>
     */
    public function all(): Collection
    {
        $state = $this->state();

        return collect($this->definitions)
            ->map(fn (array $definition, string $key) => [
                'key' => $key,
                'name' => $definition['name'],
                'description' => $definition['description'] ?? '',
                'icon' => $definition['icon'] ?? 'box',
                'core' => (bool) ($definition['core'] ?? false),
                'available' => (bool) ($definition['available'] ?? true),
                'enabled' => $this->resolveEnabled($key, $definition, $state),
                'nav' => $definition['nav'] ?? null,
            ]);
    }

    public function exists(string $key): bool
    {
        return array_key_exists($key, $this->definitions);
    }

    public function enabled(string $key): bool
    {
        if (! $this->exists($key)) {
            return false;
        }

        return $this->resolveEnabled($key, $this->definitions[$key], $this->state());
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
        return $this->all()
            ->filter(fn (array $module) => $module['enabled'] && $module['nav'] && isset($module['nav']['route']) && Route::has($module['nav']['route']))
            ->sortBy(fn (array $module) => $module['nav']['position'] ?? 0)
            ->map(fn (array $module) => [
                'key' => $module['key'],
                'label' => $module['nav']['label'],
                'icon' => $module['icon'],
                'href' => route($module['nav']['route'], absolute: false),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    public function enabledKeys(): array
    {
        return $this->all()->filter(fn (array $module) => $module['enabled'])->keys()->all();
    }

    public function flush(): void
    {
        $this->state = null;
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
     * @param  array<string, mixed>  $definition
     * @param  array<string, bool>  $state
     */
    private function resolveEnabled(string $key, array $definition, array $state): bool
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
