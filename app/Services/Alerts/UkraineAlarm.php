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
 * Типи тривог API: AIR, ARTILLERY, URBAN_FIGHTS, CHEMICAL, NUCLEAR, INFO (UNKNOWN вважаємо повітряною).
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
    ];

    /**
     * 🔴 Червона (критичний рівень, негайно в укриття): AIR, CHEMICAL, NUCLEAR.
     * 🟡 Жовта (підвищена увага): ARTILLERY, URBAN_FIGHTS, INFO — і будь-яка тривога лише в районі чи громаді
     * всередині області, коли людина обрала всю область.
     */
    public const RED = ['AIR', 'CHEMICAL', 'NUCLEAR'];

    public static function severity(string $type, bool $local = false): string
    {
        return ! $local && in_array(self::type($type), self::RED, true) ? 'red' : 'yellow';
    }

    public function __construct(private readonly SiteSettings $settings) {}

    /** Ключ: config('services.ukraine_alarm.key') (UKRAINE_ALARM_KEY у .env), інакше — з Адмінка → Інтеграції. */
    public function key(): ?string
    {
        $key = config('services.ukraine_alarm.key') ?: $this->settings->secret('ukrainealarm_token');

        return is_string($key) && $key !== '' ? $key : null;
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
    public function active(): ?array
    {
        $json = $this->get('/alerts');
        if (! is_array($json)) {
            return null;
        }
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
            }
        }

        return $out;
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

    /** Секрет у адресі нашого вебхука: з конфігу або похідний від APP_KEY (не зберігається окремо). */
    public function webhookSecret(): string
    {
        $secret = config('services.ukraine_alarm.webhook_secret');

        return is_string($secret) && $secret !== '' ? $secret : substr(hash_hmac('sha256', 'ukraine-alarm-webhook', (string) config('app.key')), 0, 40);
    }

    public function webhookUrl(): string
    {
        return url('/api/alerts/ukraine-alarm/'.$this->webhookSecret());
    }

    /** POST /api/v3/webhook — сервер UkraineAlarm кличе нас на кожну зміну в усіх областях. */
    public function registerWebhook(): bool
    {
        $states = array_values(array_map(fn ($r) => $r['id'], array_filter($this->regions(), fn ($r) => $r['type'] === 'State')));

        return $this->send('post', '/webhook', ['webHookUrl' => $this->webhookUrl(), 'regionIds' => $states]);
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
