<?php

namespace App\Support\Plugins;

use App\Support\Settings\SiteSettings;

/**
 * Інтегровані функції сайту. Меню ними не керує: для розділів є модулі.
 */
class Plugins
{
    public function __construct(private readonly SiteSettings $settings) {}

    public function on(string $key): bool
    {
        if ($this->find($key) === null) {
            return false;
        }

        $stored = $this->settings->get('plugins');
        if (! is_array($stored) || ! array_key_exists($key, $stored)) {
            return true;
        }

        return (bool) $stored[$key];
    }

    public function ensure(string $key): void
    {
        abort_unless($this->on($key), 404);
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
        return array_map(fn (array $item) => [...$item, 'enabled' => $this->on($item['key'])], $this->items());
    }

    /**
     * @return list<array{key: string, group: string, name: string, description: string}>
     */
    private function items(): array
    {
        $items = config('plugins');

        return is_array($items) ? array_values(array_filter($items, 'is_array')) : [];
    }

    /**
     * @return array{key: string, group: string, name: string, description: string}|null
     */
    private function find(string $key): ?array
    {
        foreach ($this->items() as $item) {
            if (($item['key'] ?? null) === $key) {
                return $item;
            }
        }

        return null;
    }
}
