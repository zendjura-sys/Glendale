<?php

namespace App\Services\Alerts;

use App\Enums\AlertScale;
use App\Enums\AlertType;
use App\Models\AirThreat;
use App\Models\User;
use App\Services\Geo\VisitorCountry;
use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Мапа тривог і радар цілей (лише для України): стан тривог — виключно з офіційного API UkraineAlarm v3,
 * повітряні цілі з публічних зведень Повітряних сил ЗСУ (t.me/s/kpszsu) — лише приблизне місце (центр міста
 * чи області з повідомлення) і курс. Жодних точних координат, даних від людей, місць влучань і роботи ППО.
 */
class AirAlertService
{
    /** Скільки секунд тримаємо зібраний стан. */
    public const TTL = 15;

    /** Пріоритет виду тривоги, коли їх кілька на одній території. */
    public const RANK = ['artillery' => 1, 'urban_fights' => 2, 'air_raid' => 3, 'chemical' => 4, 'nuclear' => 5];

    /** Скільки неофіційних каналів читаємо за один запуск (решта — наступними хвилинами). */
    public const BATCH = 30;

    /** Скільки хвилин «живе» ціль кожного типу. */
    public const LIFETIME = ['uav' => 25, 'missile' => 10, 'ballistic' => 6, 'kab' => 15, 'mig' => 20, 'artillery' => 15];

    /** Приблизна швидкість, км/год (лише для підпису на мапі). */
    public const SPEED = ['uav' => 180, 'missile' => 750, 'ballistic' => 2500, 'kab' => 400, 'mig' => 0, 'artillery' => 0];

    /** Швидкість різновиду (км/год), якщо відрізняється від типу: реактивний «Шахед», «Гербера», FPV. */
    public const VARIANT_SPEED = ['jet' => 500, 'gerbera' => 150, 'fpv' => 90];

    /**
     * 26 регіонів: 24 області, м. Київ і АР Крим — назва, центр і основні міста для прив’язки цілей.
     * `keys` — основи слів зі зведень («Сумщина», «на Київщину»), міста додаються самі.
     *
     * @var array<string, array{name: string, lat: float, lng: float, cities: list<string>, keys: list<string>}>
     */
    public const REGIONS = [
        'vinnytsia' => ['name' => 'Вінницька область', 'lat' => 49.23, 'lng' => 28.47, 'cities' => ['Вінниця', 'Жмеринка', 'Козятин', 'Хмільник', 'Могилів-Подільський'], 'keys' => ['вінниччин', 'вінницьк']],
        'volyn' => ['name' => 'Волинська область', 'lat' => 50.75, 'lng' => 25.33, 'cities' => ['Луцьк', 'Ковель', 'Нововолинськ'], 'keys' => ['волин']],
        'dnipropetrovsk' => ['name' => 'Дніпропетровська область', 'lat' => 48.46, 'lng' => 35.04, 'cities' => ['Дніпро', 'Кривий Ріг', 'Кам’янське', 'Нікополь', 'Павлоград', 'Марганець'], 'keys' => ['дніпропетровщин', 'дніпропетровськ', 'дніпровщин', 'кривор', 'кривий ріг', 'кривого рогу']],
        'donetsk' => ['name' => 'Донецька область', 'lat' => 48.02, 'lng' => 37.80, 'cities' => ['Краматорськ', 'Слов’янськ', 'Покровськ', 'Костянтинівка', 'Маріуполь', 'Донецьк'], 'keys' => ['донеччин', 'донецьк']],
        'zhytomyr' => ['name' => 'Житомирська область', 'lat' => 50.25, 'lng' => 28.66, 'cities' => ['Житомир', 'Бердичів', 'Коростень', 'Звягель'], 'keys' => ['житомирщин', 'житомирськ']],
        'zakarpattia' => ['name' => 'Закарпатська область', 'lat' => 48.62, 'lng' => 22.29, 'cities' => ['Ужгород', 'Мукачево', 'Хуст', 'Берегове'], 'keys' => ['закарпатт', 'закарпатськ']],
        'zaporizhzhia' => ['name' => 'Запорізька область', 'lat' => 47.84, 'lng' => 35.14, 'cities' => ['Запоріжжя', 'Енергодар', 'Оріхів', 'Мелітополь', 'Бердянськ'], 'keys' => ['запоріжж', 'запорізьк', 'запорізщин']],
        'ivano-frankivsk' => ['name' => 'Івано-Франківська область', 'lat' => 48.92, 'lng' => 24.71, 'cities' => ['Івано-Франківськ', 'Калуш', 'Коломия', 'Бурштин'], 'keys' => ['прикарпатт', 'франківщин', 'івано-франківськ']],
        'kyiv-oblast' => ['name' => 'Київська область', 'lat' => 50.05, 'lng' => 30.95, 'cities' => ['Біла Церква', 'Бровари', 'Бориспіль', 'Ірпінь', 'Буча', 'Фастів', 'Обухів', 'Вишгород'], 'keys' => ['київщин', 'київськ']],
        'kirovohrad' => ['name' => 'Кіровоградська область', 'lat' => 48.51, 'lng' => 32.26, 'cities' => ['Кропивницький', 'Олександрія', 'Світловодськ'], 'keys' => ['кіровоградщин', 'кіровоградськ']],
        'luhansk' => ['name' => 'Луганська область', 'lat' => 48.57, 'lng' => 39.31, 'cities' => ['Сєвєродонецьк', 'Лисичанськ', 'Старобільськ', 'Луганськ'], 'keys' => ['луганщин', 'луганськ']],
        'lviv' => ['name' => 'Львівська область', 'lat' => 49.84, 'lng' => 24.03, 'cities' => ['Львів', 'Дрогобич', 'Стрий', 'Червоноград', 'Самбір'], 'keys' => ['львівщин', 'львівськ', 'льв']],
        'mykolaiv' => ['name' => 'Миколаївська область', 'lat' => 46.97, 'lng' => 31.99, 'cities' => ['Миколаїв', 'Первомайськ', 'Южноукраїнськ', 'Вознесенськ', 'Очаків'], 'keys' => ['миколаївщин', 'миколаївськ']],
        'odesa' => ['name' => 'Одеська область', 'lat' => 46.48, 'lng' => 30.72, 'cities' => ['Одеса', 'Ізмаїл', 'Чорноморськ', 'Білгород-Дністровський', 'Подільськ'], 'keys' => ['одещин', 'одеськ', 'одес']],
        'poltava' => ['name' => 'Полтавська область', 'lat' => 49.59, 'lng' => 34.55, 'cities' => ['Полтава', 'Кременчук', 'Лубни', 'Миргород', 'Горішні Плавні'], 'keys' => ['полтавщин', 'полтавськ']],
        'rivne' => ['name' => 'Рівненська область', 'lat' => 50.62, 'lng' => 26.25, 'cities' => ['Рівне', 'Вараш', 'Дубно', 'Сарни'], 'keys' => ['рівненщин', 'рівненськ']],
        'sumy' => ['name' => 'Сумська область', 'lat' => 50.91, 'lng' => 34.80, 'cities' => ['Суми', 'Конотоп', 'Шостка', 'Охтирка', 'Ромни'], 'keys' => ['сумщин', 'сумськ']],
        'ternopil' => ['name' => 'Тернопільська область', 'lat' => 49.55, 'lng' => 25.59, 'cities' => ['Тернопіль', 'Чортків', 'Кременець'], 'keys' => ['тернопільщин', 'тернопільськ']],
        'kharkiv' => ['name' => 'Харківська область', 'lat' => 49.99, 'lng' => 36.23, 'cities' => ['Харків', 'Ізюм', 'Куп’янськ', 'Лозова', 'Чугуїв', 'Балаклія'], 'keys' => ['харківщин', 'харківськ']],
        'kherson' => ['name' => 'Херсонська область', 'lat' => 46.64, 'lng' => 32.62, 'cities' => ['Херсон', 'Берислав', 'Нова Каховка'], 'keys' => ['херсонщин', 'херсонськ']],
        'khmelnytskyi' => ['name' => 'Хмельницька область', 'lat' => 49.42, 'lng' => 26.99, 'cities' => ['Хмельницький', 'Кам’янець-Подільський', 'Шепетівка', 'Старокостянтинів', 'Нетішин'], 'keys' => ['хмельниччин', 'хмельницьк']],
        'cherkasy' => ['name' => 'Черкаська область', 'lat' => 49.44, 'lng' => 32.06, 'cities' => ['Черкаси', 'Умань', 'Сміла', 'Золотоноша'], 'keys' => ['черкащин', 'черкаськ']],
        'chernivtsi' => ['name' => 'Чернівецька область', 'lat' => 48.29, 'lng' => 25.94, 'cities' => ['Чернівці', 'Новодністровськ'], 'keys' => ['буковин', 'чернівеччин', 'чернівецьк']],
        'chernihiv' => ['name' => 'Чернігівська область', 'lat' => 51.49, 'lng' => 31.29, 'cities' => ['Чернігів', 'Ніжин', 'Прилуки', 'Новгород-Сіверський'], 'keys' => ['чернігівщин', 'чернігівськ']],
        'kyiv' => ['name' => 'м. Київ', 'lat' => 50.45, 'lng' => 30.52, 'cities' => ['Київ'], 'keys' => ['києв', 'київ ', 'київ.', 'київ,', 'столиц']],
        'crimea' => ['name' => 'Автономна Республіка Крим', 'lat' => 45.04, 'lng' => 34.0, 'cities' => ['Сімферополь', 'Севастополь', 'Керч', 'Феодосія', 'Джанкой', 'Євпаторія'], 'keys' => ['крим', 'кримськ']],
    ];

    /** Курс за словами зведення (градуси від півночі за годинниковою стрілкою). */
    private const COURSES = [
        'північно-західн' => 315, 'північно-східн' => 45, 'південно-західн' => 225, 'південно-східн' => 135,
        'північн' => 0, 'східн' => 90, 'південн' => 180, 'західн' => 270,
    ];

    /** «з півночі» — ціль летить на південь. */
    private const FROM_SIDE = ['з півночі' => 180, 'з півдня' => 0, 'зі сходу' => 270, 'з сходу' => 270, 'із заходу' => 90, 'з заходу' => 90];

    public function __construct(private readonly SiteSettings $settings) {}

    /** Чи показувати розділ: людина з України (за IP чи профілем) або сама обрала свою область. */
    public function isAvailableFor(Request $request, ?User $user = null): bool
    {
        if (! app(Plugins::class)->on('air_alerts')) {
            return false;
        }
        $user ??= $request->user();
        // Кому показувати — налаштування в Адмінка → Інтеграції → «Мапа тривог».
        $mode = (string) ($this->settings->get('alerts_visibility') ?: 'ukraine');
        if ($mode === 'all') {
            return true;
        }
        if ($mode === 'admins') {
            return $user instanceof User && $user->isAdmin();
        }
        // Україна: країна в профілі, обрана область, українська мова інтерфейсу або IP з України.
        if ($user instanceof User && ($user->country === 'UA' || is_string($user->pref('alert_region')) || $user->locale === 'uk')) {
            return true;
        }

        return app(VisitorCountry::class)->of($request) === 'UA';
    }

    /**
     * Стан для мапи: області, прапорці загроз, активні цілі й стрічка зведень.
     *
     * @return array<string, mixed>
     */
    public function state(): array
    {
        return Cache::remember('alerts.state', self::TTL, fn () => $this->build());
    }

    /**
     * @return array<string, mixed>
     */
    private function build(): array
    {
        $fetched = $this->fetchAlerts();
        $now = CarbonImmutable::now();
        // Цілі й стрічка: NEPTUN (якщо відповідає), інакше власний розбір каналів.
        $neptun = app(Neptun::class);
        $cards = $neptun->threatCards();
        $feed = $cards !== null ? $neptun->feed() : null;
        $cards ??= AirThreat::query()->where('expires_at', '>', $now)->orderByDesc('detected_at')->limit(80)->get()
            ->map(fn (AirThreat $t) => $t->toCard())->values()->all();
        $types = array_column($cards, 'type');
        $levels = $this->threatLevels($cards);
        $noData = $fetched['stale'] && $fetched['regions'] === [];

        $regions = [];
        foreach (self::REGIONS as $slug => $region) {
            $alert = $fetched['regions'][$slug] ?? null;
            $started = $alert !== null && $alert['started_at'] !== null ? CarbonImmutable::parse($alert['started_at']) : null;
            // Усі види тривог області + рівні загроз з цілей (червоний — балістика/КАБ/ракети, жовтий — БпЛА).
            $all = [];
            foreach (array_keys($alert['codes'] ?? []) as $code) {
                $all[] = AlertType::from($code);
            }
            foreach ($levels[$slug] ?? [] as $level) {
                $all[] = $level;
            }
            // Повітряна тривога за правилами оповіщення: жовтий рівень — лише БпЛА, червоний — ракети (з БпЛА чи без).
            // API v3 цього не розрізняє (лише AIR), тож рівень беремо з цілей на радарі; немає даних — червоний.
            $air = in_array(AlertType::AIR, $all, true);
            $airLevel = ! $air ? null : (in_array(AlertType::UAV, $all, true) && ! in_array(AlertType::BALLISTIC, $all, true) ? 'yellow' : 'red');
            if ($airLevel === 'yellow') {
                $all = array_values(array_filter($all, fn (AlertType $t) => $t !== AlertType::AIR));
            }
            $sorted = AlertType::sorted($all);
            $primary = $noData && $sorted === [] ? AlertType::NO_DATA : AlertType::primary($sorted);
            $regions[] = [
                'slug' => $slug,
                'name' => $region['name'],
                'lat' => $region['lat'],
                'lng' => $region['lng'],
                'active' => $alert !== null,
                'type' => $alert['type'] ?? null,
                'kind' => $alert['kind'] ?? null,
                // Головна тривога (найвищий пріоритет), вторинні бейджі й масштаб повітряної тривоги.
                'alert' => $primary->value,
                'alerts' => array_map(fn (AlertType $t) => $t->value, $sorted),
                'threat_levels' => array_map(fn (AlertType $t) => $t->value, $levels[$slug] ?? []),
                'air_level' => $airLevel,
                'scale' => $alert === null ? null : ($alert['type'] === 'partial' ? AlertScale::RAION->value : AlertScale::OBLAST->value),
                'started_at' => $started?->toIso8601String(),
                'minutes' => $started !== null ? max(0, (int) $started->diffInMinutes($now)) : null,
            ];
        }
        $units = [];
        foreach ($fetched['units'] as $code => $unit) {
            $units[] = [
                'code' => $code,
                'kind' => $unit['kind'],
                // Єдиний код типу (AlertType) і масштаб (AlertScale) — для кольору заливки.
                'type' => AlertType::fromApi($unit['kind'])->value,
                'scale' => $unit['scale'] ?? AlertScale::OBLAST->value,
                'started_at' => $unit['started_at'],
            ];
        }

        return [
            'regions' => $regions,
            'units' => $units,
            'active_count' => count(array_filter($regions, fn (array $r) => $r['active'])),
            'mig_active' => in_array('mig', $types, true),
            'ballistic_threat' => in_array('ballistic', $types, true),
            'threats' => $cards,
            'feed' => $feed ?? array_slice((array) Cache::get('alerts.feed', []), 0, 20),
            'source' => $fetched['source'],
            // Обов’язковий підпис-посилання, коли показуємо дані NEPTUN.
            'attribution' => $fetched['source'] === 'NEPTUN' || $feed !== null
                ? ['text' => Neptun::ATTRIBUTION, 'url' => Neptun::BASE.'/'] : null,
            'stale' => $fetched['stale'],
            'updated_at' => $now->toIso8601String(),
        ];
    }

    /** Рівень повітряної тривоги в області: yellow — лише БпЛА, red — ракети чи невідомо. */
    public function airLevel(?string $slug): string
    {
        foreach ($slug !== null ? $this->state()['regions'] : [] as $region) {
            if (is_array($region) && ($region['slug'] ?? null) === $slug) {
                $uav = in_array('UAV', (array) ($region['threat_levels'] ?? []), true);
                $missile = in_array('BALLISTIC', (array) ($region['threat_levels'] ?? []), true);

                return $uav && ! $missile ? 'yellow' : 'red';
            }
        }

        return 'red';
    }

    /**
     * Рівні загроз областей з активних цілей: балістика, КАБ і ракети — червоний (BALLISTIC), БпЛА — жовтий (UAV).
     * Спостереження без тривоги (advisory) і мітки без області не враховуємо.
     *
     * @param  array<int, array<string, mixed>>  $cards
     * @return array<string, list<AlertType>>
     */
    private function threatLevels(array $cards): array
    {
        $out = [];
        foreach ($cards as $card) {
            $slug = $card['region'] ?? null;
            if (! is_string($slug) || ! isset(self::REGIONS[$slug]) || ($card['advisory'] ?? false) === true) {
                continue;
            }
            $level = match ($card['type'] ?? null) {
                'ballistic', 'kab', 'missile' => AlertType::BALLISTIC,
                'uav' => AlertType::UAV,
                default => null,
            };
            if ($level !== null) {
                $out[$slug][$level->value] = $level;
            }
        }

        return array_map(fn (array $levels) => AlertType::sorted($levels), $out);
    }

    /**
     * Активні тривоги — ВИКЛЮЧНО з офіційного API UkraineAlarm v3. Інших джерел статусу немає: без ключа
     * чи коли API мовчить — останній вдалий стан (до 10 хв) з позначкою «може бути неактуальним».
     *
     * @return array{regions: array<string, array{type: string, kind: string, started_at: string|null, codes?: array<string, bool>}>, units: array<string, array{kind: string, started_at: string|null, scale?: string, codes?: array<string, bool>}>, source: string|null, stale: bool}
     */
    public function fetchAlerts(): array
    {
        $key = app(UkraineAlarm::class)->key();
        $rows = $key !== null ? $this->fromUkraineAlarm($key) : null;
        if ($rows !== null) {
            Cache::put('alerts.last', $rows, now()->addMinutes(10));

            return [...$this->aggregate($rows), 'source' => 'UkraineAlarm', 'stale' => false];
        }

        return [...$this->aggregate($this->cachedRows()), 'source' => null, 'stale' => true];
    }

    /**
     * Останні вдалі рядки з кешу (перевіряємо форму — кеш міг лишитися від старішої версії).
     *
     * @return list<array{oblast: string, level: int, code: string|null, kind: string, started_at: string|null}>
     */
    private function cachedRows(): array
    {
        $rows = [];
        foreach ((array) Cache::get('alerts.last', []) as $row) {
            if (! is_array($row) || ! is_string($row['oblast'] ?? null) || ! is_int($row['level'] ?? null) || ! is_string($row['kind'] ?? null) || ! isset(self::RANK[$row['kind']])) {
                continue;
            }
            $rows[] = [
                'oblast' => $row['oblast'],
                'level' => $row['level'],
                'code' => is_string($row['code'] ?? null) ? $row['code'] : null,
                'kind' => $row['kind'],
                'started_at' => is_string($row['started_at'] ?? null) ? $row['started_at'] : null,
            ];
        }

        return $rows;
    }

    /** Вид тривоги з будь-якого API → air_raid | artillery | urban_fights | chemical | nuclear. */
    public static function kindOf(string $raw): string
    {
        return match (strtolower(trim($raw))) {
            'artillery', 'artillery_shelling' => 'artillery',
            'urban_fights', 'urban_fight' => 'urban_fights',
            'chemical' => 'chemical',
            'nuclear', 'radiation' => 'nuclear',
            default => 'air_raid',
        };
    }

    /**
     * Рядки «одиниця під тривогою» → стан областей (повна чи часткова тривога) і стан районів/громад для заливки.
     * Тривога на всю область заливає всі її райони; на район — район; на громаду — громаду.
     *
     * @param  list<array{oblast: string, level: int, code: string|null, kind: string, started_at: string|null}>  $rows
     * @return array{regions: array<string, array{type: string, kind: string, started_at: string|null, codes?: array<string, bool>}>, units: array<string, array{kind: string, started_at: string|null, scale?: string, codes?: array<string, bool>}>}
     */
    private function aggregate(array $rows): array
    {
        $regions = [];
        $units = [];
        $put = function (array &$into, string $key, array $value): void {
            $current = $into[$key] ?? null;
            if ($current === null || AlertType::fromApi($value['kind'])->priority() > AlertType::fromApi($current['kind'])->priority()) {
                $into[$key] = [...$value, 'codes' => $current['codes'] ?? []];
            }
            // Усі види тривог регіону — для вторинних бейджів.
            $into[$key]['codes'][AlertType::fromApi($value['kind'])->value] = true;
        };
        foreach ($rows as $row) {
            $whole = $row['level'] === 1;
            $put($regions, $row['oblast'], [
                'type' => $row['kind'] === 'air_raid' ? ($whole ? 'air_raid' : 'partial') : $row['kind'],
                'kind' => $row['kind'],
                'started_at' => $row['started_at'],
            ]);
            // Повна тривога в області важливіша за часткову з тим самим видом.
            if ($whole && $regions[$row['oblast']]['type'] === 'partial') {
                $regions[$row['oblast']]['type'] = 'air_raid';
            }
            $value = ['kind' => $row['kind'], 'started_at' => $row['started_at'], 'scale' => AlertScale::fromLevel($row['level'])->value];
            $codes = $whole ? AlertUnits::raionsOf($row['oblast']) : ($row['code'] !== null ? [$row['code']] : []);
            foreach ($codes as $code) {
                $put($units, $code, $value);
            }
        }

        return ['regions' => $regions, 'units' => $units];
    }

    /**
     * Офіційний API UkraineAlarm v3 (GET /api/v3/alerts). Кожен елемент activeAlerts має власні regionId і regionType:
     * усередині області можуть бути як тривога на всю область (State), так і окремі райони (District) чи громади
     * (Community). Тож рівень і місце беремо з самої тривоги, а не з об’єкта області. Область і район —
     * з довідника /api/v3/regions.
     *
     * @return list<array{oblast: string, level: int, code: string|null, kind: string, started_at: string|null}>|null
     */
    private function fromUkraineAlarm(string $key): ?array
    {
        try {
            $response = Http::timeout(3)->withHeaders(['Authorization' => $key])->acceptJson()->get(UkraineAlarm::BASE.'/alerts');
        } catch (ConnectionException) {
            return null;
        }
        if (! $response->successful() || ! is_array($response->json())) {
            return null;
        }
        $tree = app(UkraineAlarm::class)->regions();
        $rows = [];
        foreach ((array) $response->json() as $region) {
            if (! is_array($region)) {
                continue;
            }
            foreach ((array) ($region['activeAlerts'] ?? []) as $alert) {
                if (! is_array($alert)) {
                    continue;
                }
                $id = (string) ($alert['regionId'] ?? $region['regionId'] ?? '');
                $type = (string) ($alert['regionType'] ?? $region['regionType'] ?? 'State');
                $node = $tree[$id] ?? null;
                $state = $node !== null ? ($tree[$node['state']] ?? null) : null;
                $slug = $this->slugFor($state['name'] ?? (string) ($region['regionName'] ?? ''));
                if ($slug === null) {
                    continue;
                }
                $level = $type === 'District' ? 2 : ($type === 'Community' ? 3 : 1);
                if ($slug === 'kyiv') {
                    $level = 1;
                }
                $raion = $level === 3 && $node !== null && isset($tree[(string) $node['parent']]) ? AlertUnits::find($slug, 2, $tree[(string) $node['parent']]['name']) : null;
                $name = $node['name'] ?? (string) ($region['regionName'] ?? '');
                $rows[] = [
                    'oblast' => $slug,
                    'level' => $level,
                    'code' => $level === 1 ? null : AlertUnits::find($slug, $level, $name, $raion),
                    'kind' => self::kindOf(UkraineAlarm::type($alert['type'] ?? 'AIR')),
                    'started_at' => isset($alert['lastUpdate']) ? (string) $alert['lastUpdate'] : null,
                ];
            }
        }

        return $rows;
    }

    /** Slug регіону за назвою з API («Київська область», «м. Київ», «Автономна Республіка Крим»). */
    public function slugFor(string $name): ?string
    {
        $name = mb_strtolower(trim($name));
        if ($name === '') {
            return null;
        }
        if (str_contains($name, 'київ') && ! str_contains($name, 'область')) {
            return 'kyiv';
        }
        if (str_contains($name, 'севастоп')) {
            return 'crimea';
        }
        foreach (self::REGIONS as $slug => $region) {
            if ($name === mb_strtolower($region['name'])) {
                return $slug;
            }
        }
        $stem = mb_substr(explode(' ', $name)[0], 0, 6);
        foreach (self::REGIONS as $slug => $region) {
            if ($slug !== 'kyiv' && str_starts_with(mb_strtolower($region['name']), $stem)) {
                return $slug;
            }
        }

        return null;
    }

    /**
     * Нові зведення каналів (команда alerts:sync щохвилини): цілі на мапу, стрічка й сповіщення
     * тим, у кого щойно почалась або скінчилась тривога в обраній області.
     *
     * @return array{threats: int, notified: int}
     */
    public function syncThreats(): array
    {
        $created = 0;
        // Цілі вже дає NEPTUN — власний розбір десятків каналів не потрібен (запасний шлях, коли він мовчить).
        $posts = app(Neptun::class)->threatCards() === null ? $this->fetchChannels($this->channelsForRun()) : [];
        foreach ($posts as $post) {
            $created += $this->ingest($post) ? 1 : 0;
        }
        AirThreat::query()->where('expires_at', '<', now()->subDay())->delete();
        Cache::forget('alerts.state');
        // Сповіщення про тривогу й відбій — окремо, кожні 10 с (alerts:watch).
        $notified = 0;
        Log::info('alerts: sync', ['threats' => $created, 'notified' => $notified]);

        return ['threats' => $created, 'notified' => $notified];
    }

    /**
     * Усі увімкнені канали: каталог за групами з налаштувань + додані адміністратором.
     *
     * @return list<string>
     */
    public function channels(): array
    {
        $groups = array_filter(array_map('trim', explode(',', (string) ($this->settings->get('alerts_source_groups') ?? 'official,intel,regional,aggregators'))));
        $out = [];
        foreach (AlertSources::CHANNELS as $name => [$group]) {
            if (in_array($group, $groups, true)) {
                $out[] = $name;
            }
        }
        $extra = array_map(
            fn (string $c) => preg_replace('/[^A-Za-z0-9_]/', '', ltrim(trim($c), '@')) ?? '',
            preg_split('/[\s,]+/', (string) $this->settings->get('alerts_monitor_channels')) ?: [],
        );

        return array_values(array_unique(array_filter([...$out, ...$extra])));
    }

    /**
     * Джерела для вкладки «Джерела»: групи з описом і каналами (увімкнені — з налаштувань).
     *
     * @return list<array{group: string, title: string, about: string, enabled: bool, channels: list<array{name: string, regions: list<string>}>}>
     */
    public function sources(): array
    {
        $enabled = $this->channels();
        $groups = [];
        foreach (AlertSources::GROUPS as $key => $group) {
            $channels = [];
            foreach ($key === 'custom' ? array_filter($enabled, fn (string $c) => AlertSources::group($c) === 'custom') : array_keys(array_filter(AlertSources::CHANNELS, fn (array $c) => $c[0] === $key)) as $name) {
                $names = [];
                foreach (AlertSources::CHANNELS[$name][1] ?? [] as $slug) {
                    $names[] = self::REGIONS[$slug]['name'];
                }
                $channels[] = ['name' => $name, 'regions' => $names];
            }
            if ($channels !== []) {
                $groups[] = ['group' => $key, 'title' => $group['title'], 'about' => $group['about'], 'enabled' => $key === 'custom' || in_array($channels[0]['name'], $enabled, true), 'channels' => $channels];
            }
        }

        return $groups;
    }

    /**
     * Канали на цей запуск: офіційні — щоразу, решта — по черзі порціями (щоб не смикати
     * всі сторінки щохвилини); кожен канал оновлюється раз на кілька хвилин.
     *
     * @return list<string>
     */
    private function channelsForRun(): array
    {
        $all = $this->channels();
        $official = array_values(array_filter($all, fn (string $c) => AlertSources::group($c) === 'official'));
        $rest = array_values(array_diff($all, $official));
        if ($rest === []) {
            return $official;
        }
        $cursor = (int) Cache::get('alerts.cursor', 0) % count($rest);
        $batch = array_slice([...$rest, ...$rest], $cursor, min(self::BATCH, count($rest)));
        Cache::put('alerts.cursor', $cursor + count($batch), now()->addDay());

        return array_values(array_unique([...$official, ...$batch]));
    }

    /**
     * Публічні сторінки каналів t.me/s/{channel} паралельно.
     *
     * @param  list<string>  $channels
     * @return list<array{ref: string, channel: string, text: string, at: CarbonImmutable}>
     */
    public function fetchChannels(array $channels): array
    {
        if ($channels === []) {
            return [];
        }
        try {
            $responses = Http::pool(fn (Pool $pool) => array_map(
                fn (string $channel) => $pool->as($channel)->timeout(6)->withHeaders(['Accept-Language' => 'uk'])->get('https://t.me/s/'.$channel),
                $channels,
            ));
        } catch (Throwable) {
            return [];
        }
        $posts = [];
        foreach ($responses as $response) {
            if ($response instanceof Response && $response->successful()) {
                array_push($posts, ...$this->parseChannel($response->body()));
            }
        }
        // Старіші спершу: тоді перше джерело створює мітку, наступні — підтверджують.
        usort($posts, fn (array $a, array $b) => $a['at']->getTimestamp() <=> $b['at']->getTimestamp());

        return $posts;
    }

    /**
     * @return list<array{ref: string, channel: string, text: string, at: CarbonImmutable}>
     */
    public function parseChannel(string $html): array
    {
        $posts = [];
        foreach (preg_split('/class="tgme_widget_message_wrap/', $html) ?: [] as $chunk) {
            if (preg_match('/data-post="([A-Za-z0-9_]+\/\d+)"/', $chunk, $ref) !== 1) {
                continue;
            }
            if (preg_match('/<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)<\/div>/s', $chunk, $body) !== 1) {
                continue;
            }
            $text = trim(html_entity_decode(strip_tags(str_replace(['<br/>', '<br>', '<br />'], "\n", $body[1])), ENT_QUOTES | ENT_HTML5));
            $at = preg_match('/<time[^>]*datetime="([^"]+)"/', $chunk, $time) === 1 ? CarbonImmutable::parse($time[1]) : CarbonImmutable::now();
            if ($text !== '') {
                $posts[] = ['ref' => $ref[1], 'channel' => explode('/', $ref[1])[0], 'text' => $text, 'at' => $at];
            }
        }

        return $posts;
    }

    /**
     * Допис → стрічка й (якщо впізнали тип і місце) мітка на мапі. Та сама ціль з іншого каналу
     * (той самий тип і місце за останні 15 хв) не дублюється, а підтверджує мітку: росте упевненість.
     * Старі (понад годину) дописи пропускаємо.
     *
     * @param  array{ref: string, channel?: string, text: string, at: CarbonImmutable}  $post
     */
    public function ingest(array $post): bool
    {
        if ($post['at']->lt(CarbonImmutable::now()->subHour())) {
            return false;
        }
        $channel = $post['channel'] ?? explode('/', $post['ref'])[0];
        $this->remember($post, $channel);
        if (AirThreat::query()->where('source_ref', $post['ref'])->exists()) {
            return false;
        }
        $regions = AlertSources::CHANNELS[$channel][1] ?? null;
        $parsed = $this->parse($post['text'], is_array($regions) && count($regions) === 1 ? $regions[0] : null);
        if ($parsed === null) {
            return false;
        }
        $same = AirThreat::query()->where('type', $parsed['type'])->where('expires_at', '>', $post['at'])
            ->where('detected_at', '>=', $post['at']->subMinutes(15))
            ->where(fn ($q) => $parsed['place_name'] !== null ? $q->where('place_name', $parsed['place_name']) : $q->whereNull('region_slug'))
            ->latest('detected_at')->first();
        if ($same !== null) {
            $sources = array_values(array_unique([...($same->sources ?? []), $channel]));
            $same->update([
                'sources' => $sources,
                'confidence' => AlertSources::confidence($sources),
                'course_deg' => $same->course_deg ?? $parsed['course_deg'],
                'variant' => $same->variant ?? $parsed['variant'],
                'expires_at' => max($same->expires_at, $post['at']->addMinutes(self::LIFETIME[$parsed['type']])),
            ]);

            return false;
        }
        AirThreat::query()->create([
            ...$parsed,
            'title' => Str::limit(preg_replace('/\s+/u', ' ', $post['text']) ?? $post['text'], 290),
            'speed_kmh' => self::VARIANT_SPEED[$parsed['variant'] ?? ''] ?? self::SPEED[$parsed['type']],
            'source_ref' => $post['ref'],
            'sources' => [$channel],
            'confidence' => AlertSources::confidence([$channel]),
            'detected_at' => $post['at'],
            'expires_at' => $post['at']->addMinutes(self::LIFETIME[$parsed['type']]),
        ]);

        return true;
    }

    /**
     * Стрічка останніх зведень (без дублікатів, нові вгорі).
     *
     * @param  array{ref: string, text: string, at: CarbonImmutable}  $post
     */
    private function remember(array $post, string $channel): void
    {
        $feed = array_values(array_filter((array) Cache::get('alerts.feed', []), fn ($item) => is_array($item) && ($item['ref'] ?? null) !== $post['ref']));
        array_unshift($feed, ['ref' => $post['ref'], 'channel' => $channel, 'group' => AlertSources::group($channel), 'text' => Str::limit($post['text'], 400), 'at' => $post['at']->toIso8601String()]);
        usort($feed, fn (array $a, array $b) => strcmp((string) $b['at'], (string) $a['at']));
        Cache::put('alerts.feed', array_slice($feed, 0, 40), now()->addHours(6));
    }

    /**
     * Тип загрози, місце й курс з тексту зведення; null — не впізнали.
     *
     * @return array{type: string, variant: string|null, region_slug: string|null, place_name: string|null, lat: float, lng: float, course_deg: int|null}|null
     */
    public function parse(string $text, ?string $home = null): ?array
    {
        $lower = mb_strtolower($text);
        $type = match (true) {
            str_contains($lower, 'балістик') => 'ballistic',
            preg_match('/(*UCP)\bкаб(и|ів)?\b|керован\w* авіабомб/u', $lower) === 1 => 'kab',
            preg_match('/(міг|миг|mig)-?31/u', $lower) === 1 => 'mig',
            preg_match('/ракет|крилат|швидкісн\w* ціл|калібр|х-101|х-59/u', $lower) === 1 => 'missile',
            preg_match('/бпла|шахед|герань|гербер|безпілот|дрон|мопед|fpv|фпв|квадрокоптер|бандерол|невідом\w* ціл|ціль не визначен/u', $lower) === 1 => 'uav',
            default => null,
        };
        if ($type === null) {
            return null;
        }
        $variant = match (true) {
            $type === 'uav' && preg_match('/реактивн|герань-?[35]|шахед-?238|ш-238/u', $lower) === 1 => 'jet',
            $type === 'uav' && str_contains($lower, 'бандерол') => 'banderol',
            $type === 'uav' && preg_match('/невідом\w* ціл|ціль не визначен|неідентифік/u', $lower) === 1 => 'unknown',
            $type === 'uav' && str_contains($lower, 'гербер') => 'gerbera',
            $type === 'uav' && preg_match('/fpv|фпв|квадрокоптер|мавік|mavic/u', $lower) === 1 => 'fpv',
            $type === 'uav' && preg_match('/шахед|герань|мопед/u', $lower) === 1 => 'shahed',
            $type === 'missile' && preg_match('/крилат|х-101|калібр|х-55|х-59|х-69/u', $lower) === 1 => 'cruise',
            default => null,
        };
        $mentions = $this->mentions($lower);
        $origin = null;
        $target = null;
        foreach ($mentions as $mention) {
            $before = mb_substr($lower, max(0, $mention['pos'] - 14), min(14, $mention['pos']));
            if ($origin === null && preg_match('/(^|\s)(з|із|зі|від)\s+$/u', $before) === 1) {
                $origin = $mention;
            } elseif ($target === null && preg_match('/(на|в|у|напрямку|курсом на|до)\s+$/u', $before) === 1) {
                $target = $mention;
            }
        }
        $place = $origin ?? $target ?? ($mentions[0] ?? null);
        if ($place === null && $home !== null && isset(self::REGIONS[$home])) {
            // Регіональний канал без назви місця — пишуть про свою область.
            $region = self::REGIONS[$home];
            $place = ['slug' => $home, 'place' => $region['name'], 'lat' => $region['lat'], 'lng' => $region['lng'], 'pos' => 0];
        }
        if ($place === null) {
            // Без місця ціль на мапу не ставимо; МіГ-31 і балістика — загальний прапорець без точки (region null).
            return in_array($type, ['mig', 'ballistic'], true) ? ['type' => $type, 'variant' => null, 'region_slug' => null, 'place_name' => null, 'lat' => 49.0, 'lng' => 31.3, 'course_deg' => null] : null;
        }
        $course = null;
        if ($origin !== null && $target !== null && $origin['slug'] !== $target['slug']) {
            $course = $this->bearing($origin['lat'], $origin['lng'], $target['lat'], $target['lng']);
        } else {
            foreach (self::FROM_SIDE as $words => $deg) {
                if (str_contains($lower, $words)) {
                    $course = $deg;
                    break;
                }
            }
            if ($course === null && preg_match('/курс\w*\s+(на\s+)?(\S+)|(\S+)\s+курс/u', $lower, $m) === 1) {
                foreach (self::COURSES as $word => $deg) {
                    if (str_contains($m[0], $word)) {
                        $course = $deg;
                        break;
                    }
                }
            }
        }

        return [
            'type' => $type,
            'variant' => $variant,
            'region_slug' => $place['slug'],
            'place_name' => $place['place'],
            'lat' => $place['lat'],
            'lng' => $place['lng'],
            'course_deg' => $course,
        ];
    }

    /**
     * Згадки регіонів і міст у тексті за порядком появи.
     *
     * @return list<array{slug: string, place: string, lat: float, lng: float, pos: int}>
     */
    private function mentions(string $lower): array
    {
        $found = [];
        foreach (self::REGIONS as $slug => $region) {
            $words = [];
            foreach ($region['cities'] as $i => $city) {
                $c = mb_strtolower($city);
                $words[] = ['stem' => self::stem($c), 'place' => $city, 'city' => $i];
            }
            foreach ($region['keys'] as $key) {
                $words[] = ['stem' => $key, 'place' => $region['name'], 'city' => null];
            }
            foreach ($words as $word) {
                $pos = mb_strpos($lower, $word['stem']);
                if ($pos === false) {
                    continue;
                }
                // Місто — трохи вбік від центру області, щоб цілі не злипались (лише приблизно).
                $shift = $word['city'] === null ? 0.0 : (($word['city'] % 3) - 1) * 0.25;
                $found[] = ['slug' => $slug, 'place' => $word['place'], 'lat' => $region['lat'] + $shift * 0.6, 'lng' => $region['lng'] + $shift, 'pos' => $pos];
                break;
            }
        }
        usort($found, fn (array $a, array $b) => $a['pos'] <=> $b['pos']);

        return $found;
    }

    /**
     * Основа назви міста для пошуку в будь-якому відмінку: «Чернігів» → «черніг» (Черніговом),
     * «Харків» → «харк» (Харкова), «Полтава» → «полтав». Короткі назви («Київ») — повністю.
     */
    public static function stem(string $city): string
    {
        $stem = (string) preg_replace('/(ів|їв|ця|ці|ь|а|я|и|е|о|і)$/u', '', $city);

        return mb_strlen($stem) >= 4 ? $stem : $city;
    }

    /** Азимут з точки A на точку B, градуси 0–359. */
    public function bearing(float $lat1, float $lng1, float $lat2, float $lng2): int
    {
        $p1 = deg2rad($lat1);
        $p2 = deg2rad($lat2);
        $dl = deg2rad($lng2 - $lng1);
        $y = sin($dl) * cos($p2);
        $x = cos($p1) * sin($p2) - sin($p1) * cos($p2) * cos($dl);

        return ((int) round(rad2deg(atan2($y, $x))) + 360) % 360;
    }

    /**
     * Перевірка всіх джерел для кнопки «Перевірити» в адмінці: що відповіло, що ні й чому.
     *
     * @return array{ok: bool, message: string}
     */
    public function diagnose(): array
    {
        $lines = [];
        $ok = false;
        $check = function (string $label, ?string $secret, callable $fetch) use (&$lines, &$ok): void {
            if ($secret !== null && $secret === '') {
                $lines[] = '— '.$label.': ключ не задано';

                return;
            }
            try {
                $rows = $fetch();
            } catch (Throwable $e) {
                $rows = null;
            }
            if ($rows === null) {
                $lines[] = '❌ '.$label.': '.($secret !== null ? 'ключ відхилено або сервіс недоступний' : 'недоступний');

                return;
            }
            $ok = true;
            $lines[] = '✅ '.$label.': відповідає'.(is_int($rows) ? ', записів: '.$rows : '');
        };
        $official = (string) app(UkraineAlarm::class)->key();
        if ($official === '') {
            $lines[] = '❌ UkraineAlarm: немає ключа — без нього тривог і сповіщень немає (інших джерел статусу не використовуємо).';
        } else {
            $check('UkraineAlarm /alerts', $official, fn () => ($r = $this->fromUkraineAlarm($official)) === null ? null : count($r));
            $check('UkraineAlarm /alerts/status', $official, fn () => app(UkraineAlarm::class)->lastActionIndex());
            $check('UkraineAlarm /regions', $official, fn () => ($r = app(UkraineAlarm::class)->regions()) === [] ? null : count($r));
        }
        $neptun = app(Neptun::class);
        if (! $neptun->enabled()) {
            $lines[] = '— NEPTUN: вимкнено в налаштуваннях';
        } else {
            Cache::forget('alerts.neptun.'.md5('/api/v1/alerts'));
            Cache::forget('alerts.neptun.'.md5('/api/v1/threats'));
            $check('NEPTUN цілі', null, fn () => ($r = $neptun->threatCards()) === null ? null : count($r));
        }
        Cache::forget('alerts.state');
        $source = $this->fetchAlerts()['source'];
        $lines[] = $source !== null ? 'Зараз мапа бере тривоги з: '.$source : 'UkraineAlarm зараз не відповідає — мапа покаже останній збережений стан.';
        $lines[] = 'Показ: '.match ((string) ($this->settings->get('alerts_visibility') ?: 'ukraine')) {
            'all' => 'усім',
            'admins' => 'лише адміністраторам',
            default => 'людям з України (IP, країна в профілі, українська мова чи обрана область)',
        }.(app(Plugins::class)->on('air_alerts') ? '' : ' · ⚠️ плагін «Мапа тривог» вимкнено в Плагінах');

        return ['ok' => $ok, 'message' => implode("\n", $lines)];
    }

    /** Чи працює бодай одне джерело (для картки інтеграції). */
    public function test(): bool
    {
        return $this->diagnose()['ok'];
    }
}
