<?php

namespace App\Services\Alerts;

use App\Support\Settings\SiteSettings;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Офіційний API «Тривога» (api.ukrainealarm.com, v3). Ключ — у заголовку Authorization (Адмінка → Інтеграції).
 *
 *   GET /api/v3/alerts             — регіони з активними тривогами (activeAlerts: regionId, regionType, type, lastUpdate);
 *   GET /api/v3/alerts/{regionId}  — тривоги одного регіону;
 *   GET /api/v3/alerts/status      — lastActionIndex: змінюється з кожною новою тривогою чи відбоєм;
 *   GET /api/v3/regions            — дерево: області (State) → райони (District) → громади (Community).
 *
 * Типи тривог API: AIR, ARTILLERY, URBAN_FIGHTS, CHEMICAL, NUCLEAR, INFO, CUSTOM (UNKNOWN вважаємо повітряною).
 * Рівень тривоги — activeAlertLevels: [{alertLevel: Red|Yellow, reason, createdAt}] (актуальний — найсвіжіший).
 * Рівні регіонів: State, District, Community, CityOrVillage, CityDistrict, Null.
 */
class UkraineAlarm
{
    public const BASE = 'https://api.ukrainealarm.com/api/v3';

    /** Тип → [назва тривоги, назва відбою]. Порядок — для показу у виборі. */
    public const TYPES = [
        'AIR' => ['Повітряна тривога', 'Відбій повітряної тривоги'],
        'ARTILLERY' => ['Загроза артобстрілу', 'Відбій загрози артобстрілу'],
        'URBAN_FIGHTS' => ['Вуличні бої', 'Відбій загрози вуличних боїв'],
        'CHEMICAL' => ['Хімічна загроза', 'Відбій хімічної загрози'],
        'NUCLEAR' => ['Радіаційна небезпека', 'Відбій радіаційної небезпеки'],
        'INFO' => ['Інформаційне повідомлення', 'Кінець інформаційного повідомлення'],
        'CUSTOM' => ['Тривога', 'Відбій тривоги'],
    ];

    /**
     * Рівень тривоги з останньої відповіді /alerts: regionId → тип → red|yellow (з activeAlertLevels).
     *
     * @var array<string, array<string, string>>
     */
    private array $levels = [];

    /**
     * 🔴 Червона (критичний рівень, негайно в укриття): AIR, CHEMICAL, NUCLEAR.
     * 🟡 Жовта (підвищена увага): ARTILLERY, URBAN_FIGHTS, INFO — і будь-яка тривога лише в районі чи громаді
     * всередині області, коли людина обрала всю область.
     */
    public const RED = ['AIR', 'CHEMICAL', 'NUCLEAR'];

    /**
     * Рівень для фільтрів «червоні / жовті». Повітряна тривога за правилами оповіщення: жовта — лише БпЛА,
     * червона — ракети (з БпЛА чи без); API цього не розрізняє, тож рівень AIR передаємо окремо ($airLevel).
     */
    public static function severity(string $type, bool $local = false, string $airLevel = 'red'): string
    {
        $type = self::type($type);
        if ($local) {
            return 'yellow';
        }
        if ($type === 'AIR') {
            return $airLevel === 'yellow' ? 'yellow' : 'red';
        }

        return in_array($type, self::RED, true) ? 'red' : 'yellow';
    }

    /**
     * Колір типу за правилами оповіщення: AIR — червоний (ракети) чи жовтий (БпЛА), артобстріл — помаранчевий,
     * вуличні бої — салатовий, хімічна — фіолетовий, радіаційна — жовтий із чорними смугами, інформаційне — синій.
     */
    public static function accent(string $type, string $airLevel = 'red'): string
    {
        return match (self::type($type)) {
            'AIR' => $airLevel === 'yellow' ? '#F59E0B' : '#EF4444',
            'ARTILLERY' => '#F97316',
            'URBAN_FIGHTS' => '#84CC16',
            'CHEMICAL' => '#A855F7',
            'NUCLEAR' => '#FACC15',
            default => '#3B82F6', // INFO, CUSTOM
        };
    }

    public function __construct(private readonly SiteSettings $settings) {}

    /** Ключ: config('services.ukraine_alarm.key') (UKRAINE_ALARM_KEY у .env), інакше — з Адмінка → Інтеграції. */
    public function key(): ?string
    {
        $key = config('services.ukraine_alarm.key') ?: $this->settings->secret('ukrainealarm_token');
        $key = is_string($key) ? trim($key) : '';

        return $key !== '' ? $key : null;
    }

    public function enabled(): bool
    {
        return $this->key() !== null;
    }

    public static function type(mixed $raw): string
    {
        $type = strtoupper(trim((string) $raw));

        return isset(self::TYPES[$type]) ? $type : 'AIR';
    }

    /**
     * Активні тривоги: regionId → [тип → час початку (ISO)]. null — API не відповів (тоді нічого не міняємо).
     *
     * @return array<string, array<string, string|null>>|null
     */
    public function active(bool $fresh = true): ?array
    {
        // Для показу людям (статус обраного місця) — короткий кеш, щоб сторінки не смикали API.
        if (! $fresh && is_array($cached = Cache::get('ua_alarm:active'))) {
            $this->levels = $cached['levels'];

            return $cached['active'];
        }
        $json = $this->get('/alerts');
        if (! is_array($json)) {
            return null;
        }
        $this->levels = [];
        $out = [];
        foreach ($json as $region) {
            if (! is_array($region)) {
                continue;
            }
            foreach ((array) ($region['activeAlerts'] ?? []) as $alert) {
                if (! is_array($alert)) {
                    continue;
                }
                $id = (string) ($alert['regionId'] ?? $region['regionId'] ?? '');
                if ($id === '') {
                    continue;
                }
                $type = self::type($alert['type'] ?? 'AIR');
                $out[$id][$type] = isset($alert['lastUpdate']) ? (string) $alert['lastUpdate'] : null;
                $level = self::levelOf($alert);
                if ($level !== null) {
                    $this->levels[$id][$type] = $level;
                }
            }
        }
        Cache::put('ua_alarm:active', ['active' => $out, 'levels' => $this->levels], 15);

        return $out;
    }

    /**
     * Рівень однієї тривоги з activeAlertLevels: найсвіжіший запис (Red → red, Yellow → yellow), інакше null.
     *
     * @param  array<string, mixed>  $alert
     */
    public static function levelOf(array $alert): ?string
    {
        $latest = null;
        foreach ((array) ($alert['activeAlertLevels'] ?? []) as $level) {
            if (is_array($level) && is_string($level['alertLevel'] ?? null) && ($latest === null || (string) ($level['createdAt'] ?? '') >= (string) ($latest['createdAt'] ?? ''))) {
                $latest = $level;
            }
        }
        $value = $latest !== null ? strtolower((string) $latest['alertLevel']) : null;

        return in_array($value, ['red', 'yellow'], true) ? $value : null;
    }

    /** Офіційний рівень тривоги цього типу для регіону (з нього самого чи з області/району над ним). */
    public function levelFor(string $id, string $type): ?string
    {
        foreach ($this->lineage($id) as $node) {
            if (isset($this->levels[$node][$type])) {
                return $this->levels[$node][$type];
            }
        }

        return null;
    }

    /** lastActionIndex: якщо не змінився — нових тривог чи відбоїв не було. */
    public function lastActionIndex(): ?int
    {
        $json = $this->get('/alerts/status');

        return is_array($json) && is_numeric($json['lastActionIndex'] ?? null) ? (int) $json['lastActionIndex'] : null;
    }

    /**
     * Плаский довідник регіонів (кеш на добу): id → назва, рівень, батьківський id, id області.
     *
     * @return array<string, array{id: string, name: string, type: string, parent: string|null, state: string}>
     */
    public function regions(): array
    {
        $cached = Cache::get('alerts.ua_tree');
        if (is_array($cached) && $cached !== []) {
            return $cached;
        }
        $json = $this->get('/regions', 8);
        $out = [];
        $walk = function (array $node, ?string $parent, ?string $state) use (&$walk, &$out): void {
            $id = (string) ($node['regionId'] ?? '');
            if ($id === '') {
                return;
            }
            $state ??= $id;
            $out[$id] = [
                'id' => $id,
                'name' => (string) ($node['regionName'] ?? ''),
                'type' => (string) ($node['regionType'] ?? 'Null'),
                'parent' => $parent,
                'state' => $state,
            ];
            foreach ((array) ($node['regionChildIds'] ?? []) as $child) {
                if (is_array($child)) {
                    $walk($child, $id, $state);
                }
            }
        };
        foreach ((array) (is_array($json) ? ($json['states'] ?? []) : []) as $state) {
            if (is_array($state)) {
                $walk($state, null, null);
            }
        }
        if ($out !== []) {
            Cache::put('alerts.ua_tree', $out, now()->addDay());
        }

        return $out;
    }

    /** Регіон і всі його «предки»: тривога на область чи район діє й на громаду в ньому. */
    public function lineage(string $id): array
    {
        $tree = $this->regions();
        $ids = [];
        while ($id !== '' && ! in_array($id, $ids, true)) {
            $ids[] = $id;
            $id = (string) ($tree[$id]['parent'] ?? '');
        }

        return $ids;
    }

    /**
     * Які типи тривог зараз діють для регіону (з урахуванням області й району над ним).
     *
     * @param  array<string, array<string, string|null>>  $active
     * @return array<string, string|null>
     */
    public function typesFor(string $id, array $active): array
    {
        $types = [];
        foreach ($this->lineage($id) as $node) {
            foreach ($active[$node] ?? [] as $type => $since) {
                $types[$type] ??= $since;
            }
        }

        return $types;
    }

    /** id області в довіднику API за slug з мапи (за назвою). */
    public function stateIdFor(string $slug): ?string
    {
        $service = app(AirAlertService::class);
        foreach ($this->regions() as $region) {
            if ($region['type'] === 'State' && $service->slugFor($region['name']) === $slug) {
                return $region['id'];
            }
        }

        return null;
    }

    /**
     * Райони й громади області для вибору «моє місце».
     *
     * @return list<array{id: string, name: string, communities: list<array{id: string, name: string}>}>
     */
    public function unitsOf(string $slug): array
    {
        $state = $this->stateIdFor($slug);
        if ($state === null) {
            return [];
        }
        $districts = [];
        $communities = [];
        foreach ($this->regions() as $region) {
            if ($region['parent'] === $state) {
                $districts[$region['id']] = $region;
            } elseif ($region['state'] === $state && $region['parent'] !== null) {
                $communities[$region['parent']][] = ['id' => $region['id'], 'name' => $region['name']];
            }
        }
        $out = [];
        foreach ($districts as $id => $district) {
            $list = $communities[$id] ?? [];
            usort($list, fn ($a, $b) => strcmp($a['name'], $b['name']));
            $out[] = ['id' => $id, 'name' => $district['name'], 'communities' => $list];
        }
        usort($out, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return $out;
    }

    /** Назва рівня регіону для людей. */
    public static function typeLabel(string $type): string
    {
        return match ($type) {
            'State' => 'Область',
            'District' => 'Район',
            'Community' => 'Територіальна громада',
            'CityOrVillage' => 'Населений пункт',
            'CityDistrict' => 'Район міста',
            default => 'Місце',
        };
    }

    /**
     * Один рівень довідника для екрана вибору (як у «Тривозі»): без parent — області, інакше діти вузла.
     *
     * @return list<array{id: string, name: string, type: string, has_children: bool}>
     */
    public function childrenOf(?string $parent): array
    {
        $tree = $this->regions();
        $parents = [];
        foreach ($tree as $region) {
            if ($region['parent'] !== null) {
                $parents[$region['parent']] = true;
            }
        }
        $out = [];
        foreach ($tree as $region) {
            if ($region['parent'] === ($parent === '' ? null : $parent)) {
                $out[] = ['id' => $region['id'], 'name' => $region['name'], 'type' => $region['type'], 'has_children' => isset($parents[$region['id']])];
            }
        }
        $collator = class_exists(\Collator::class) ? new \Collator('uk_UA') : null;
        usort($out, fn ($a, $b) => $collator?->compare($a['name'], $b['name']) ?? strcmp($a['name'], $b['name']));

        return $out;
    }

    /**
     * Дерево області будь-якої глибини (як у застосунку «Тривога»): район → громада → місто/село → район міста.
     *
     * @return list<array{id: string, name: string, type: string, children: list<array<string, mixed>>}>
     */
    public function treeOf(string $slug): array
    {
        $state = $this->stateIdFor($slug);
        if ($state === null) {
            return [];
        }
        $children = [];
        foreach ($this->regions() as $region) {
            if ($region['state'] === $state && $region['parent'] !== null) {
                $children[$region['parent']][] = $region;
            }
        }
        $build = function (string $parent) use (&$build, $children): array {
            $out = [];
            foreach ($children[$parent] ?? [] as $node) {
                $out[] = ['id' => $node['id'], 'name' => $node['name'], 'type' => $node['type'], 'children' => $build($node['id'])];
            }
            usort($out, fn ($a, $b) => strcmp($a['name'], $b['name']));

            return $out;
        };

        return $build($state);
    }

    /**
     * Пошук місця за назвою по всій Україні: «Коростень», «Бердичівська громада»…
     *
     * @return list<array{id: string, name: string, type: string, type_label: string, path: string}>
     */
    public function search(string $query, int $limit = 30): array
    {
        $q = mb_strtolower(trim($query));
        if (mb_strlen($q) < 2) {
            return [];
        }
        $tree = $this->regions();
        // Як у «Тривозі»: спершу точний збіг назви (без «м.», «с.», «смт»), потім початок назви, потім будь-де;
        // за рівних — місто/село, громада, район, область.
        $order = ['CityOrVillage' => 0, 'Community' => 1, 'District' => 2, 'State' => 3, 'CityDistrict' => 4];
        $hits = [];
        foreach ($tree as $region) {
            $name = mb_strtolower($region['name']);
            $bare = preg_replace('/^(м\.|с\.|смт\.?|селище|село|місто)\s*/u', '', $name) ?? $name;
            $rank = match (true) {
                $bare === $q => 0,
                str_starts_with($bare, $q) => 1,
                mb_strpos($name, $q) !== false => 2,
                default => null,
            };
            if ($rank !== null) {
                $hits[] = [$rank, $order[$region['type']] ?? 5, $region];
            }
        }
        usort($hits, fn ($a, $b) => [$a[0], $a[1], mb_strlen($a[2]['name'])] <=> [$b[0], $b[1], mb_strlen($b[2]['name'])]);

        return array_map(fn ($hit) => [
            'id' => $hit[2]['id'],
            'name' => $hit[2]['name'],
            'type' => $hit[2]['type'],
            'type_label' => self::typeLabel($hit[2]['type']),
            'path' => $this->pathLabel($hit[2]['id']),
        ], array_slice($hits, 0, $limit));
    }

    /** «Житомирська область · Коростенський район» — над місцем, без нього самого. */
    public function pathLabel(string $id): string
    {
        $tree = $this->regions();
        $names = [];
        foreach (array_slice($this->lineage($id), 1) as $node) {
            $names[] = $tree[$node]['name'] ?? '';
        }

        return implode(' · ', array_reverse(array_filter($names)));
    }

    /** ID від області вниз до місця (для каскаду виборів). @return list<string> */
    public function pathIds(string $id): array
    {
        return array_reverse($this->lineage($id));
    }

    /**
     * Чи зараз тривога в місці (з урахуванням району й області над ним) — для картки «Моє місце».
     *
     * @return list<array{type: string, name: string, since: string|null, level: string|null, accent: string, severity: string}>
     */
    public function statusOf(string $id): array
    {
        $active = $this->active(false);
        if ($active === null) {
            return [];
        }
        $out = [];
        foreach ($this->typesFor($id, $active) as $type => $since) {
            $level = $type === 'AIR' ? ($this->levelFor($id, 'AIR') ?? 'red') : null;
            $out[] = [
                'type' => $type,
                'name' => self::TYPES[$type][0],
                'since' => $since,
                'level' => $level,
                'accent' => self::accent($type, $level ?? 'red'),
                'severity' => self::severity($type, false, $level ?? 'red'),
            ];
        }

        return $out;
    }

    /** Наша адреса для вебхука (WebHookModel.webHookUrl). Тіло вебхука — лише сигнал, стан однаково з API. */
    public function webhookUrl(): string
    {
        return url('/api/webhooks/ukraine-alarm');
    }

    /** POST /api/v3/webhook (підписка) чи PATCH (оновити адресу). */
    public function registerWebhook(bool $update = false): bool
    {
        return $this->send($update ? 'patch' : 'post', '/webhook', ['webHookUrl' => $this->webhookUrl()]);
    }

    public function deleteWebhook(): bool
    {
        return $this->send('delete', '/webhook', ['webHookUrl' => $this->webhookUrl()]);
    }

    /** @param  array<string, mixed>  $body */
    private function send(string $method, string $path, array $body): bool
    {
        $key = $this->key();
        if ($key === null) {
            return false;
        }
        try {
            return Http::timeout(8)->withHeaders(['Authorization' => $key])->acceptJson()->send(strtoupper($method), self::BASE.$path, ['json' => $body])->successful();
        } catch (ConnectionException) {
            return false;
        }
    }

    private function get(string $path, int $timeout = 4): mixed
    {
        $key = $this->key();
        if ($key === null) {
            return null;
        }
        try {
            $response = Http::timeout($timeout)->withHeaders(['Authorization' => $key])->acceptJson()->get(self::BASE.$path);
        } catch (ConnectionException) {
            return null;
        }

        return $response->successful() ? $response->json() : null;
    }
}
