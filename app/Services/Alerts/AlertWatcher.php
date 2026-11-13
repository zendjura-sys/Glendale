<?php

namespace App\Services\Alerts;

use App\Models\Family;
use App\Models\User;
use App\Notifications\AirAlertNotice;
use App\Services\Families\FamilyBot;
use App\Services\Push\PushNotifier;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Сповіщення про тривоги — ВИКЛЮЧНО за даними офіційного API UkraineAlarm v3.
 *
 * Кожні 10 с (і миттєво на вебхук) перевіряємо GET /api/v3/alerts/status. Той самий lastActionIndex, що в Redis, —
 * одразу виходимо: /alerts не запитуємо й нічого не створюємо. Змінився — читаємо /alerts і проганяємо скінченний
 * автомат по кожному обраному людьми регіону (regionId) і типу тривоги:
 *
 *   ua_alarm_state:{regionId}:{type}  — тип діє для регіону (у ньому самому чи в області/районі над ним);
 *     [немає → є]  рівно одне сповіщення про початок (тип і lastUpdate — з API);
 *     [є → немає]  рівно одне сповіщення про відбій: оновлює рядок початку в дзвіночку й рахує тривалість;
 *     тип і далі в activeAlerts — нічого.
 *   ua_alarm_local:{stateId}:{regionId}:{type} — для тих, хто обрав усю область: тривога лише в районі чи громаді
 *     всередині неї (жовта, з назвою району).
 *
 * Перехід — під замком Cache::lock("ua_alarm_lock:{regionId}:{type}"), тож опитування й вебхук не продублюють.
 * Подія старша за 30 с або пропущена, поки воркер стояв, — лише запам’ятовується, без пушу «заднім числом».
 */
class AlertWatcher
{
    /** Пуш лише про свіжу подію: не пізніше ніж 30 с від початку (lastUpdate з API) чи відбою. */
    public const FRESH = 30;

    public const INDEX = 'ua_alarm:last_action_index';

    private const AT = 'ua_alarm_at';

    public function __construct(private readonly UkraineAlarm $api, private readonly AirAlertService $alerts) {}

    /**
     * Налаштування сповіщень людини.
     *
     * @return array{push: bool, start: bool, end: bool, red: bool, yellow: bool, silent: bool}
     */
    public static function prefsOf(User $user): array
    {
        return [
            'push' => $user->pref('alert_push', true) !== false,
            'start' => $user->pref('alert_start', true) !== false,
            'end' => $user->pref('alert_end', true) !== false,
            'red' => $user->pref('alert_red', true) !== false,
            'yellow' => $user->pref('alert_yellow', true) !== false,
            'silent' => $user->pref('alert_silent', false) === true,
        ];
    }

    /**
     * Відбій — знімаємо статус «В укритті», який людина поставила під час тривоги (свій власний статус не чіпаємо).
     */
    public static function leaveShelter(User $user): void
    {
        if ($user->status_emoji !== '🛡️' || $user->pref('shelter_since') === null) {
            return;
        }
        $user->forceFill(['status_emoji' => null, 'status' => null, 'status_until' => null])->save();
        $user->mergePref(['shelter_since' => null]);
        Cache::forget('presence.'.$user->id);
    }

    /** Скільки додаткових місць можна додати. */
    public const MAX_PLACES = 5;

    /**
     * Додаткові місця людини: [{id, label}] (дім рідних, робота…).
     *
     * @return list<array{id: string, label: string}>
     */
    public static function placesOf(User $user): array
    {
        $out = [];
        foreach ((array) $user->pref('alert_places', []) as $place) {
            if (is_array($place) && is_string($place['id'] ?? null) && $place['id'] !== '') {
                $out[] = ['id' => $place['id'], 'label' => trim((string) ($place['label'] ?? ''))];
            }
        }

        return array_slice($out, 0, self::MAX_PLACES);
    }

    /** regionId, за яким стежить людина: обраний район/громада або її область. */
    public function unitFor(User $user): ?string
    {
        $unit = $user->pref('alert_unit');
        if (is_string($unit) && $unit !== '') {
            return isset($this->api->regions()[$unit]) ? $unit : null;
        }
        $region = $user->pref('alert_region');

        return is_string($region) ? $this->api->stateIdFor($region) : null;
    }

    /**
     * Одна перевірка. $force — вебхук: зміна точно була, але стан однаково беремо з API.
     */
    public function run(bool $force = false): int
    {
        if (! $this->api->enabled()) {
            return 0;
        }

        return (int) (Cache::lock('ua_alarm_tick', 30)->get(fn () => $this->tick($force)) ?? 0);
    }

    private function tick(bool $force): int
    {
        $now = CarbonImmutable::now();
        $index = $this->api->lastActionIndex();
        if ($index === null) {
            return 0;
        }
        $last = Cache::get(self::AT);
        // Воркер стояв (перезапуск, простій) — пропущені зміни лише запам’ятовуємо.
        $silent = ! is_int($last) || $now->getTimestamp() - $last > self::FRESH;
        Cache::forever(self::AT, $now->getTimestamp());
        if (! $force && $index === Cache::get(self::INDEX)) {
            return 0;
        }
        $active = $this->api->active();
        if ($active === null) {
            return 0;
        }

        // Хто за чим стежить: regionId → люди.
        $watchers = [];
        User::query()->where(fn ($q) => $q->whereNotNull('preferences->alert_region')->orWhereNotNull('preferences->alert_unit')->orWhereNotNull('preferences->alert_places'))
            ->chunkById(500, function ($users) use (&$watchers) {
                foreach ($users as $user) {
                    if (! self::prefsOf($user)['push']) {
                        continue;
                    }
                    $main = $this->unitFor($user);
                    if ($main !== null) {
                        $watchers[$main][] = $user->id;
                    }
                    // Додаткові місця (рідні, робота) — окремі сповіщення з підписом.
                    foreach (self::placesOf($user) as $place) {
                        if ($place['id'] !== $main) {
                            $watchers[$place['id']][] = $user->id;
                        }
                    }
                }
            });
        $watchers = array_map(fn ($ids) => array_values(array_unique($ids)), $watchers);
        // Боти сімей (Discord/Telegram) з обраним місцем тривог.
        $families = self::familyWatchers();
        foreach (array_keys($families) as $unit) {
            $watchers[$unit] ??= [];
        }

        $tree = $this->api->regions();
        $sent = 0;
        foreach ($watchers as $unit => $ids) {
            $unit = (string) $unit;
            $fresh = Cache::add('ua_alarm_seen:'.$unit, 1, now()->addDays(30));
            $quiet = $silent || $fresh;
            $effective = $this->api->typesFor($unit, $active);
            foreach (array_keys(UkraineAlarm::TYPES) as $type) {
                $sent += $this->transition("ua_alarm_state:{$unit}:{$type}", "ua_alarm_lock:{$unit}:{$type}", isset($effective[$type]), $effective[$type] ?? null, $quiet, $now,
                    fn (bool $started, ?string $since, bool $raised = false) => $this->notify($ids, $started, $type, $tree[$unit]['name'] ?? '', $unit, false, $since, $now, $raised, $families[$unit] ?? []),
                    $this->api->levelFor($unit, $type));
            }
            // Обрана вся область — тривоги лише в її районах чи громадах (жовті, з назвою району).
            if ($ids !== [] && ($tree[$unit]['type'] ?? null) === 'State') {
                $sent += $this->locals($unit, $ids, $active, $effective, $tree, $quiet, $now);
            }
        }
        Cache::forever(self::INDEX, $index);

        return $sent;
    }

    /**
     * @param  list<int>  $ids
     * @param  array<string, array<string, string|null>>  $active
     * @param  array<string, string|null>  $effective
     * @param  array<string, array{id: string, name: string, type: string, parent: string|null, state: string}>  $tree
     */
    private function locals(string $state, array $ids, array $active, array $effective, array $tree, bool $quiet, CarbonImmutable $now): int
    {
        $now_keys = [];
        foreach ($active as $region => $types) {
            if ($region === $state || ($tree[$region]['state'] ?? null) !== $state) {
                continue;
            }
            foreach ($types as $type => $since) {
                // Тривога вже на всю область — локальна нічого не додає.
                if (! isset($effective[$type])) {
                    $now_keys["{$region}:{$type}"] = $since;
                }
            }
        }
        $known = Cache::get("ua_alarm_local_keys:{$state}", []);
        $known = is_array($known) ? $known : [];
        $sent = 0;
        foreach (array_unique([...array_keys($now_keys), ...$known]) as $key) {
            [$region, $type] = explode(':', $key, 2);
            $sent += $this->transition("ua_alarm_local:{$state}:{$key}", "ua_alarm_lock:{$region}:{$type}", array_key_exists($key, $now_keys), $now_keys[$key] ?? null, $quiet, $now,
                fn (bool $started, ?string $since, bool $raised = false) => $this->notify($ids, $started, $type, $tree[$region]['name'] ?? '', $state.'/'.$region, true, $since, $now, $raised));
        }
        Cache::forever("ua_alarm_local_keys:{$state}", array_keys($now_keys));

        return $sent;
    }

    /**
     * Скінченний автомат одного ключа: сповіщення лише на зміну стану.
     *
     * @param  callable(bool, ?string): int  $notify
     */
    private function transition(string $key, string $lock, bool $on, ?string $since, bool $quiet, CarbonImmutable $now, callable $notify, ?string $level = null): int
    {
        return (int) (Cache::lock($lock, 30)->block(5, function () use ($key, $on, $since, $quiet, $now, $notify, $level) {
            $prev = Cache::get($key);
            if ($on && ! is_array($prev)) {
                Cache::forever($key, ['since' => $since ?? $now->toIso8601String(), 'level' => $level]);

                return $quiet || ! $this->fresh($since, $now) ? 0 : $notify(true, $since);
            }
            if ($on && is_array($prev) && $level !== null && ($prev['level'] ?? null) !== $level) {
                // Та сама тривога, але API змінив рівень: жовтий → червоний — окреме сповіщення «рівень підвищено».
                Cache::forever($key, [...$prev, 'level' => $level]);

                return ! $quiet && ($prev['level'] ?? null) === 'yellow' && $level === 'red' ? $notify(true, $prev['since'] ?? $since, true) : 0;
            }
            if (! $on && is_array($prev)) {
                Cache::forget($key);

                return $quiet ? 0 : $notify(false, $prev['since'] ?? null);
            }

            return 0;
        }));
    }

    private function fresh(?string $at, CarbonImmutable $now): bool
    {
        if ($at === null || $at === '') {
            return true;
        }
        try {
            return $now->getTimestamp() - CarbonImmutable::parse($at)->getTimestamp() <= self::FRESH;
        } catch (Throwable) {
            return true;
        }
    }

    /**
     * Початок — новий рядок у дзвіночку; відбій — оновлює рядок початку (тривалість), щоб пара не засмічувала стрічку.
     *
     * @param  list<int>  $ids
     */
    private function notify(array $ids, bool $started, string $type, string $name, string $place, bool $local, ?string $since, CarbonImmutable $now, bool $raised = false, array $families = []): int
    {
        $alertKey = md5($place.'|'.$type.'|'.$since);
        // Повітряна тривога: жовтий рівень — лише БпЛА, червоний — ракети.
        // Рівень AIR — офіційний з API (activeAlertLevels: Red/Yellow); якщо API його не дав — за цілями на радарі.
        $region = str_contains($place, '/') ? explode('/', $place)[1] : $place;
        $airLevel = $type !== 'AIR' ? 'red' : ($this->api->levelFor($region, 'AIR') ?? Cache::get('ua_alarm_level:'.$alertKey) ?? $this->alerts->airLevel($this->oblastOf($place)));
        if ($started) {
            Cache::put('ua_alarm_level:'.$alertKey, $airLevel, now()->addDays(3));
        }
        $severity = UkraineAlarm::severity($type, $local, $airLevel);

        // Замок на одну зміну стану: паралельні опитування й вебхук не створять дубль.
        $status = $raised ? 'raised' : ($started ? 'on' : 'off');

        $sent = (int) (Cache::lock('ua_alarm_notify:'.$place.':'.$type.':'.$status, 60)->block(10, fn () => $this->deliver($ids, $started, $type, $name, $local, $since, $now, $alertKey, $airLevel, $severity, $raised, $place)));
        if ($families !== []) {
            $this->announce($families, new AirAlertNotice($started, $name, $type, $now->toIso8601String(), $local, $alertKey, $since, false, $airLevel, $raised), $alertKey.':'.$status);
        }

        return $sent;
    }

    /**
     * Сім’ї, що ввімкнули тривоги в боті: regionId → id сімей. Вебхуки зашифровані, тож читаємо в PHP (сімей мало).
     *
     * @return array<string, list<int>>
     */
    public static function familyWatchers(): array
    {
        $out = [];
        Family::query()->whereNotNull('webhooks')->select(['id', 'webhooks'])->chunkById(500, function ($families) use (&$out) {
            foreach ($families as $family) {
                $unit = $family->webhook('alerts');
                $bot = $family->webhook('discord') || ($family->webhook('telegram_token') && $family->webhook('telegram_chat'));
                if (is_string($unit) && $unit !== '' && $bot) {
                    $out[$unit][] = $family->id;
                }
            }
        });

        return $out;
    }

    /**
     * Тривога чи відбій у бот сім’ї. У черзі — щоб повільний Discord/Telegram не затримував пуші людям.
     *
     * @param  list<int>  $families
     */
    private function announce(array $families, AirAlertNotice $notice, string $key): void
    {
        $data = $notice->toArray(new \stdClass);
        $icon = match ($data['severity']) {
            'clear' => '🟢',
            'red' => '🔴',
            default => '🟡',
        };
        $text = $icon.' '.$data['text']."\n".$data['excerpt'];
        foreach ($families as $id) {
            // Та сама зміна стану — один раз на сім’ю, навіть якщо вебхук і опитування збіглися.
            if (! Cache::add('ua_alarm_family:'.$id.':'.$key, 1, now()->addMinutes(10))) {
                continue;
            }
            dispatch(function () use ($id, $text) {
                $family = Family::query()->find($id);
                if ($family !== null) {
                    rescue(fn () => app(FamilyBot::class)->send($family, $text, 'Тривога'), report: false);
                }
            });
        }
    }

    /** Область (slug) регіону з довідника: для обраного місця «unit» чи «state/district». */
    private function oblastOf(string $place): ?string
    {
        $id = explode('/', $place)[0];
        $tree = $this->api->regions();
        $state = $tree[$tree[$id]['state'] ?? $id] ?? null;

        return $state !== null ? $this->alerts->slugFor($state['name']) : null;
    }

    /** @param  list<int>  $ids */
    private function deliver(array $ids, bool $started, string $type, string $name, bool $local, ?string $since, CarbonImmutable $now, string $alertKey, string $airLevel, string $severity, bool $raised = false, string $place = ''): int
    {
        $count = 0;
        foreach (User::query()->whereKey($ids)->get() as $user) {
            // Чужим (додатковим) місцем стежимо з підписом; «В укритті» знімаємо лише відбоєм у своєму місці.
            $main = $this->unitFor($user);
            $label = null;
            if ($place !== $main) {
                foreach (self::placesOf($user) as $extra) {
                    if ($extra['id'] === $place) {
                        $label = $extra['label'] !== '' ? $extra['label'] : null;
                    }
                }
            }
            if (! $started && ($place === $main || str_starts_with($place, (string) $main.'/'))) {
                self::leaveShelter($user);
            }
            $prefs = self::prefsOf($user);
            if (! $prefs[$severity]) {
                continue;
            }
            // Та сама зміна стану в людини за 5 хв — блокуємо (Redis), навіть якщо стан скинули.
            if (! Cache::add('ua_alarm_sent:'.$user->id.':'.$alertKey.':'.($raised ? 'raised' : ($started ? 'on' : 'off')), 1, now()->addMinutes(5))) {
                continue;
            }
            $notice = new AirAlertNotice($started, $name, $type, $now->toIso8601String(), $local, $alertKey, $since, $prefs['silent'], $airLevel, $raised, $label);
            $row = $user->notifications()->where('type', AirAlertNotice::class)->where('data->alert_key', $alertKey)->first();
            if ($started) {
                if (! $prefs['start']) {
                    continue;
                }
                if ($raised && $row instanceof DatabaseNotification) {
                    // Рівень підвищено — оновлюємо картку цієї ж тривоги й надсилаємо пуш.
                    $row->forceFill(['data' => $notice->toArray($user), 'read_at' => null, 'created_at' => $now])->save();
                    if (! $prefs['silent']) {
                        rescue(fn () => app(PushNotifier::class)->notification($user, $row), report: false);
                    }
                } else {
                    rescue(fn () => $user->notify($notice), report: false);
                }
                $count++;

                continue;
            }
            if ($row instanceof DatabaseNotification) {
                // Пара «початок + відбій» — один рядок: оновлюємо, піднімаємо нагору.
                $row->forceFill(['data' => $notice->toArray($user), 'read_at' => null, 'created_at' => $now])->save();
                if ($prefs['end'] && ! $prefs['silent']) {
                    rescue(fn () => app(PushNotifier::class)->notification($user, $row), report: false);
                }
                $count += $prefs['end'] ? 1 : 0;
            } elseif ($prefs['end']) {
                rescue(fn () => $user->notify($notice), report: false);
                $count++;
            }
        }

        return $count;
    }
}
