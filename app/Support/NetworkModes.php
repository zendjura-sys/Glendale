<?php

namespace App\Support;

use App\Models\User;
use App\Support\Modules\ModuleManager;
use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;

/**
 * Режими соцмережі («Геймер», «Класика», «Пригоди»…): яку частину сайту бачить людина.
 * Режим лише ховає зайве в інтерфейсі — меню, віджети, кнопки. Вимкнене адміністратором
 * для всього сайту лишається вимкненим у будь-якому режимі. Набір режимів налаштовується
 * в Адмінка → Режими й зберігається в налаштуваннях сайту (network_modes).
 *
 * @phpstan-type Mode array{id: string, name: string, description: string, icon: string, enabled: bool, builtin: bool, modules: list<string>, plugins_off: list<string>, features: array<string, bool>}
 */
class NetworkModes
{
    public const SETTING = 'network_modes';

    /** Окремі можливості інтерфейсу, які не є модулями чи плагінами. */
    public const FEATURES = ['stories', 'live', 'playing'];

    /** Значки режимів (Lucide), з яких можна обирати в адмінці. */
    public const ICONS = ['gamepad-2', 'sparkles', 'compass', 'clapperboard', 'feather', 'layers', 'music-2', 'users-round', 'swords', 'heart'];

    private const GAMING = ['servers', 'games', 'clans', 'quests', 'moments', 'party', 'families'];

    /** Модулі, додані після появи режимів: у збережених раніше режимах їх ще не було. */
    private const ADDED_LATER = ['phone'];

    public function __construct(
        private readonly SiteSettings $settings,
        private readonly ModuleManager $modules,
        private readonly Plugins $plugins,
    ) {}

    /**
     * Типові режими (з них починається сайт і до них повертає «Скинути»).
     *
     * @return list<Mode>
     */
    public function presets(): array
    {
        $all = $this->moduleKeys();
        $without = fn (array $hide): array => array_values(array_diff($all, $hide));
        $mode = fn (string $id, string $name, string $description, string $icon, array $modules, array $features) => [
            'id' => $id,
            'name' => $name,
            'description' => $description,
            'icon' => $icon,
            'enabled' => true,
            'builtin' => true,
            'modules' => $modules,
            'plugins_off' => [],
            'features' => array_replace(array_fill_keys(self::FEATURES, true), $features),
        ];

        // Через normalize(): ті самі правила, що й для збережених режимів.
        return array_values(array_filter(array_map(fn (array $item) => $this->normalize($item), [
            $mode('all', 'Усе включено', 'Усе, що вміє GameCon: ігри, кіно, музика, спільноти й історії.', 'layers', $all, []),
            $mode('gamer', 'Геймер', 'Ігри, сервери, клани, пошук паті, завдання й моменти. Без історій і кіно — лише гра.', 'gamepad-2', $without(['cinema']), ['stories' => false]),
            $mode('classic', 'Класика', 'Звична соцмережа: друзі, повідомлення, музика, фото, спільноти й події. Без кіно, ігрових розділів і моментів.', 'sparkles', $without(['cinema', ...self::GAMING]), ['live' => false, 'playing' => false]),
            $mode('adventure', 'Пригоди', 'Музика, кіно, фото, спільноти й події. Без ігрових розділів.', 'compass', $without(self::GAMING), ['live' => false, 'playing' => false]),
            $mode('cinema', 'Кіноман', 'Кіно й перегляд разом, музика, фото та спільноти.', 'clapperboard', $without([...self::GAMING, 'events']), ['live' => false, 'playing' => false]),
            $mode('minimal', 'Мінімал', 'Лише головне: стрічка, друзі, повідомлення, фото й спільноти.', 'feather', ['profile', 'feed', 'friends', 'people', 'messages', 'communities', 'photos'], ['live' => false, 'playing' => false, 'stories' => false]),
        ])));
    }

    /**
     * @return array{default: string, modes: list<Mode>}
     */
    public function config(): array
    {
        $stored = $this->settings->get(self::SETTING);
        $modes = is_array($stored) && is_array($stored['modes'] ?? null)
            ? array_values(array_filter(array_map(fn ($mode) => $this->normalize($mode), $stored['modes'])))
            : $this->presets();
        // Модулі, що з’явилися після збереження режимів (напр. «Телефон»), видно в усіх режимах,
        // доки адміністратор сам не прибере їх із режиму.
        if (is_array($stored) && is_array($stored['modes'] ?? null)) {
            $known = is_array($stored['known_modules'] ?? null) ? $stored['known_modules'] : array_diff($this->moduleKeys(), self::ADDED_LATER);
            $new = array_values(array_diff($this->moduleKeys(), $known));
            foreach ($modes as $i => $mode) {
                $modes[$i]['modules'] = array_values(array_intersect($this->moduleKeys(), array_unique([...$mode['modules'], ...$new])));
            }
        }
        if ($modes === []) {
            $modes = $this->presets();
        }
        $default = is_array($stored) && is_string($stored['default'] ?? null) ? $stored['default'] : 'all';
        $enabled = array_column(array_filter($modes, fn (array $mode) => $mode['enabled']), 'id');

        return [
            'default' => in_array($default, $enabled, true) ? $default : ($enabled[0] ?? $modes[0]['id']),
            'modes' => $modes,
        ];
    }

    /**
     * @param  array{default: string, modes: list<array<string, mixed>>}  $config
     */
    public function save(array $config): void
    {
        $modes = array_values(array_filter(array_map(fn ($mode) => $this->normalize($mode), $config['modes'])));
        $this->settings->put([self::SETTING => ['default' => $config['default'], 'modes' => $modes, 'known_modules' => $this->moduleKeys()]]);
        $this->modules->flush();
    }

    /**
     * Режими, які людина може обрати.
     *
     * @return list<Mode>
     */
    public function available(): array
    {
        return array_values(array_filter($this->config()['modes'], fn (array $mode) => $mode['enabled']));
    }

    /**
     * Режим людини: її вибір, якщо він ще доступний, інакше типовий.
     *
     * @return Mode
     */
    public function for(?User $user): array
    {
        $config = $this->config();
        $id = $user?->pref('network_mode');
        foreach ($config['modes'] as $mode) {
            if ($mode['enabled'] && $mode['id'] === $id) {
                return $mode;
            }
        }
        foreach ($config['modes'] as $mode) {
            if ($mode['id'] === $config['default']) {
                return $mode;
            }
        }

        return $config['modes'][0];
    }

    /**
     * Модулі, які бачить людина: увімкнені на сайті ∩ режим (модулі ядра — завжди).
     *
     * @return list<string>
     */
    public function modulesFor(?User $user): array
    {
        $enabled = $this->modules->enabledKeys();
        if ($user === null) {
            return $enabled;
        }
        $mode = $this->for($user);

        return array_values(array_filter($enabled, fn (string $key) => in_array($key, $mode['modules'], true) || $this->isCore($key)));
    }

    /**
     * @return array<string, bool>
     */
    public function pluginsFor(?User $user): array
    {
        $flags = $this->plugins->flags();
        if ($user === null) {
            return $flags;
        }
        $off = $this->for($user)['plugins_off'];
        foreach ($off as $key) {
            if (array_key_exists($key, $flags)) {
                $flags[$key] = false;
            }
        }

        return $flags;
    }

    /**
     * @return array<string, bool>
     */
    public function featuresFor(?User $user): array
    {
        return $user === null ? array_fill_keys(self::FEATURES, true) : $this->for($user)['features'];
    }

    /**
     * @return list<string>
     */
    public function moduleKeys(): array
    {
        return array_values($this->modules->all()->keys()->all());
    }

    /**
     * Назви модулів для підписів («Є: Ігри, Кіно…»).
     *
     * @return array<string, string>
     */
    public function moduleNames(): array
    {
        return $this->modules->all()->map(fn (array $module) => $module['name'])->all();
    }

    private function isCore(string $key): bool
    {
        return (bool) ($this->modules->all()->get($key)['core'] ?? false);
    }

    /**
     * @return Mode|null
     */
    private function normalize(mixed $mode): ?array
    {
        if (! is_array($mode) || ! is_string($mode['id'] ?? null) || preg_match('/^[a-z0-9-]{2,32}$/', $mode['id']) !== 1) {
            return null;
        }
        $modules = $this->moduleKeys();
        $plugins = $this->plugins->keys();
        $features = is_array($mode['features'] ?? null) ? $mode['features'] : [];
        $icon = is_string($mode['icon'] ?? null) && in_array($mode['icon'], self::ICONS, true) ? $mode['icon'] : 'layers';

        return [
            'id' => $mode['id'],
            'name' => mb_substr(trim((string) ($mode['name'] ?? $mode['id'])), 0, 40),
            'description' => mb_substr(trim((string) ($mode['description'] ?? '')), 0, 200),
            'icon' => $icon,
            'enabled' => (bool) ($mode['enabled'] ?? true),
            'builtin' => (bool) ($mode['builtin'] ?? false),
            'modules' => array_values(array_intersect($modules, array_filter((array) ($mode['modules'] ?? []), 'is_string'))),
            'plugins_off' => array_values(array_intersect($plugins, array_filter((array) ($mode['plugins_off'] ?? []), 'is_string'))),
            'features' => array_combine(self::FEATURES, array_map(fn (string $key) => (bool) ($features[$key] ?? true), self::FEATURES)),
        ];
    }
}
