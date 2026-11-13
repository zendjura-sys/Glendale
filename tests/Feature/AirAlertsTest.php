<?php

namespace Tests\Feature;

use App\Enums\AlertScale;
use App\Enums\AlertType;
use App\Models\AirThreat;
use App\Models\GtaServer;
use App\Models\User;
use App\Notifications\AirAlertNotice;
use App\Services\Alerts\AirAlertService;
use App\Services\Alerts\AlertWatcher;
use App\Services\Alerts\UkraineAlarm;
use App\Services\Families\FamilyService;
use App\Support\Plugins\Plugins;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AirAlertsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Плагін за замовчуванням вимкнений (доробляється) — у тестах вмикаємо.
        app(Plugins::class)->set('air_alerts', true);
    }

    private function service(): AirAlertService
    {
        return app(AirAlertService::class);
    }

    public function test_parses_threat_type_place_and_course(): void
    {
        $uav = $this->service()->parse('Ударні БпЛА з Сумщини курсом на Полтавщину.');
        $this->assertSame('uav', $uav['type']);
        $this->assertSame('sumy', $uav['region_slug']);
        $this->assertNotNull($uav['course_deg']);
        $this->assertGreaterThan(150, $uav['course_deg']);
        $this->assertLessThan(260, $uav['course_deg']);

        $this->assertSame('ballistic', $this->service()->parse('Загроза застосування балістики з півдня!')['type']);
        $this->assertSame(0, $this->service()->parse('Загроза застосування балістики з півдня на Запоріжжя')['course_deg']);
        $this->assertSame('kab', $this->service()->parse('Пуски КАБ на Харківщину')['type']);
        $this->assertSame('missile', $this->service()->parse('Швидкісна ціль на Київ!')['type']);
        $this->assertSame('kyiv', $this->service()->parse('Швидкісна ціль на Київ!')['region_slug']);
        $this->assertSame('mig', $this->service()->parse('Зліт МіГ-31К. Повітряна тривога по всій країні.')['type']);
        $this->assertNull($this->service()->parse('Доброго ранку, Україно!'));
        // Різновиди для значка й швидкості.
        $this->assertSame('jet', $this->service()->parse('Реактивний шахед курсом на Київ')['variant']);
        $this->assertSame('gerbera', $this->service()->parse('Гербери над Черніговом')['variant']);
        $this->assertSame('fpv', $this->service()->parse('FPV-дрони біля Херсона')['variant']);
        $this->assertSame('shahed', $this->service()->parse('Шахеди на Полтаву')['variant']);
        $this->assertSame('cruise', $this->service()->parse('Крилаті ракети курсом на Львів')['variant']);
        $this->assertSame('kyiv', $this->service()->slugFor('м. Київ'));
        $this->assertSame('kyiv-oblast', $this->service()->slugFor('Київська область'));
        $this->assertSame('crimea', $this->service()->slugFor('Автономна Республіка Крим'));
    }

    /**
     * Підміна UkraineAlarm v3: довідник регіонів і поточні activeAlerts. Будь-які інші хости — 503,
     * щоб жодне стороннє джерело не могло вплинути на стан.
     *
     * @param  array<string, mixed>  $tree
     */
    private function fakeUkraineAlarm(array $tree, array &$alerts, int &$index): void
    {
        Http::fake(function ($request) use ($tree, &$alerts, &$index) {
            $url = $request->url();
            if (! str_contains($url, 'api.ukrainealarm.com')) {
                return Http::response(null, 503);
            }
            if (str_contains($url, '/api/v3/regions')) {
                return Http::response($tree);
            }
            if (str_contains($url, '/api/v3/alerts/status')) {
                return Http::response(['lastActionIndex' => $index]);
            }

            return Http::response($alerts);
        });
        app(SiteSettings::class)->putSecret('ukrainealarm_token', 'ua-alarm-key-1234567890');
    }

    /** @return array<string, mixed> */
    private function zhytomyrTree(): array
    {
        return ['states' => [[
            'regionId' => '10', 'regionName' => 'Житомирська область', 'regionType' => 'State',
            'regionChildIds' => [[
                'regionId' => '100', 'regionName' => 'Житомирський район', 'regionType' => 'District',
                'regionChildIds' => [['regionId' => '1001', 'regionName' => 'Житомирська територіальна громада', 'regionType' => 'Community', 'regionChildIds' => [
                    ['regionId' => '10011', 'regionName' => 'м. Житомир', 'regionType' => 'CityOrVillage', 'regionChildIds' => []],
                ]]],
            ], [
                'regionId' => '200', 'regionName' => 'Коростенський район', 'regionType' => 'District', 'regionChildIds' => [],
            ]],
        ]]];
    }

    /** @return array<string, mixed> */
    private function row(string $id, string $regionType, string $type, ?string $at = null): array
    {
        return ['regionId' => $id, 'regionType' => $regionType, 'regionName' => '', 'activeAlerts' => [['regionId' => $id, 'regionType' => $regionType, 'type' => $type, 'lastUpdate' => $at ?? now()->toIso8601String()]]];
    }

    public function test_status_comes_only_from_ukraine_alarm(): void
    {
        // Сторонні джерела «бачать» тривогу, але без ключа UkraineAlarm стан порожній і сповіщень немає.
        Http::fake([
            'api.alerts.in.ua/*' => Http::response(['alerts' => [['location_title' => 'Харківська область', 'location_type' => 'oblast', 'alert_type' => 'air_raid']]]),
            'ubilling.net.ua/*' => Http::response(['states' => ['Сумська область' => ['alertnow' => true]]]),
            '*' => Http::response(null, 503),
        ]);
        app(SiteSettings::class)->putSecret('alerts_in_ua_token', 'test-token-1234567890');
        $user = User::factory()->create();
        $user->mergePref(['alert_region' => 'sumy']);
        $state = $this->service()->state();
        $this->assertNull($state['source']);
        $this->assertSame(0, $state['active_count']);
        $this->assertCount(26, $state['regions']);
        $this->artisan('alerts:watch')->assertOk();
        $this->assertSame(0, $user->notifications()->count());
    }

    public function test_sync_reads_threats_but_never_notifies(): void
    {
        $at = now()->subMinutes(3)->toIso8601String();
        $html = '<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="kpszsu/101">'
            .'<div class="tgme_widget_message_text js-message_text" dir="auto">БпЛА з Чернігівщини курсом на Київщину</div>'
            .'<time datetime="'.$at.'" class="time">10:00</time></div></div>';
        Http::fake(fn ($request) => str_contains($request->url(), 't.me') ? Http::response($html) : Http::response(null, 503));
        $user = User::factory()->create();
        $user->mergePref(['alert_region' => 'kyiv-oblast']);

        // Радар цілей працює окремо: мітки є, а тривог і сповіщень без UkraineAlarm немає.
        $this->artisan('alerts:sync')->assertOk();
        $this->artisan('alerts:watch')->assertOk();
        $this->assertSame(1, AirThreat::query()->count());
        $threat = AirThreat::query()->first();
        $this->assertSame('uav', $threat->type);
        $this->assertSame('chernihiv', $threat->region_slug);
        $this->assertSame(0, $user->notifications()->count());
        $this->assertCount(1, $this->service()->state()['feed']);
    }

    public function test_state_machine_notifies_start_and_end_exactly_once_by_last_action_index(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $user = User::factory()->create(['country' => 'UA']);
        $this->actingAs($user)->getJson('/alerts/units?region=zhytomyr')->assertOk()
            ->assertJsonPath('districts.0.name', 'Житомирський район')
            ->assertJsonPath('districts.0.communities.0.id', '1001');
        $this->actingAs($user)->putJson('/alerts/preferences', ['unit' => '1001'])->assertOk()
            ->assertJsonPath('prefs.region', 'zhytomyr')
            ->assertJsonPath('prefs.unit.name', 'Житомирська територіальна громада');
        $watcher = app(AlertWatcher::class);
        $this->assertSame(0, $watcher->run()); // перший запуск лише запам'ятовує

        // lastActionIndex не змінився — /alerts навіть не запитуємо.
        $before = Http::recorded()->count();
        $this->assertSame(0, $watcher->run());
        $this->assertFalse(Http::recorded()->slice($before)->contains(fn ($pair) => str_ends_with($pair[0]->url(), '/api/v3/alerts')));

        // Тривога в сусідньому районі — не моя.
        [$alerts, $index] = [[$this->row('200', 'District', 'AIR')], 2];
        $this->assertSame(0, $watcher->run());
        // Тривога в моєму районі діє й на громаду; повтор опитування — без нових сповіщень.
        [$alerts, $index] = [[$this->row('100', 'District', 'AIR')], 3];
        $this->assertSame(1, $watcher->run());
        $this->assertSame(0, $watcher->run());
        $index = 4;
        $this->assertSame(0, $watcher->run());
        // Перейшла на всю область — та сама тривога для громади, не нове сповіщення.
        [$alerts, $index] = [[$this->row('10', 'State', 'AIR'), $this->row('100', 'District', 'AIR')], 5];
        $this->assertSame(0, $watcher->run());
        $start = $user->notifications()->first();
        $this->assertSame('red', $start->data['severity']);
        $this->assertSame('Повітряна тривога (червоний рівень): Житомирська територіальна громада', $start->data['text']);
        $this->assertSame('#EF4444', $start->data['accent']);

        // «Я в укритті» під час тривоги (з пушу чи картки) — відбій зніме його сам.
        $this->actingAs($user)->putJson('/alerts/preferences', ['shelter' => true])->assertOk();
        $this->assertSame('🛡️', $user->fresh()->status_emoji);

        // Відбій — оновлює той самий рядок у дзвіночку (пара «початок + відбій»), з тривалістю.
        $this->travel(65)->minutes();
        $watcher->run(); // воркер «стояв» — перша перевірка після паузи лише запам'ятовує
        [$alerts, $index] = [[], 6];
        $this->assertSame(1, $watcher->run());
        $this->assertSame(1, $user->notifications()->count());
        $row = $user->notifications()->first();
        $this->assertSame('air_alert_end', $row->data['kind']);
        $this->assertSame('clear', $row->data['severity']);
        $this->assertSame('Відбій повітряної тривоги: Житомирська територіальна громада', $row->data['text']);
        $this->assertStringStartsWith('Тривала 1 год 05 хв', $row->data['excerpt']);
        $this->assertNull($user->fresh()->status_emoji);
        $this->assertNull($row->read_at);
    }

    public function test_red_yellow_local_filters_and_no_backfill(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $user = User::factory()->create();
        $user->mergePref(['alert_region' => 'zhytomyr']);
        $watcher = app(AlertWatcher::class);
        $watcher->run();

        // Подія 5 хв тому (пропущена пачка) — стан запам'ятовано, пуш не йде.
        [$alerts, $index] = [[$this->row('10', 'State', 'AIR', now()->subMinutes(5)->toIso8601String())], 2];
        $this->assertSame(0, $watcher->run());
        // Артобстріл — жовта тривога.
        [$alerts, $index] = [[...$alerts, $this->row('10', 'State', 'ARTILLERY')], 3];
        $this->assertSame(1, $watcher->run());
        $data = $user->notifications()->first()->data;
        $this->assertSame(['yellow', 'ARTILLERY', 'Загроза артобстрілу: Житомирська область', '#F97316'], [$data['severity'], $data['alert_type'], $data['text'], $data['accent']]);

        // Обрана вся область, а повітряна тривога лише в районі — жовта «локальна» з назвою району.
        // (Тривога й артобстріл на всю область скінчились — два відбої, плюс локальна в районі.)
        [$alerts, $index] = [[$this->row('200', 'District', 'AIR')], 4];
        $this->assertSame(3, $watcher->run());
        $local = $user->notifications()->get()->first(fn ($n) => $n->data['local'] ?? false);
        $this->assertSame(['yellow', 'Повітряна тривога (червоний рівень) · локально: Коростенський район'], [$local->data['severity'], $local->data['text']]);

        // Фільтри: жовті вимкнено, відбій вимкнено, беззвучно — без пушу.
        $user->mergePref(['alert_yellow' => false]);
        [$alerts, $index] = [[$this->row('200', 'District', 'AIR'), $this->row('10', 'State', 'INFO')], 5];
        $this->assertSame(0, $watcher->run());
        $user->mergePref(['alert_silent' => true]);
        [$alerts, $index] = [[$this->row('10', 'State', 'NUCLEAR')], 6];
        $this->assertSame(1, $watcher->run());
        $nuclear = $user->notifications()->get()->firstWhere('data.alert_type', 'NUCLEAR');
        $this->assertTrue($nuclear->data['silent']);
        // Радіаційна — жовта «зебра».
        $this->assertSame(['#FACC15', true], [$nuclear->data['accent'], $nuclear->data['striped']]);

        // Воркер стояв 2 хв: відбій, що стався за цей час, не надсилається «заднім числом».
        $count = $user->notifications()->count();
        $this->travel(2)->minutes();
        [$alerts, $index] = [[], 7];
        $this->assertSame(0, $watcher->run());
        $this->assertSame($count, $user->notifications()->count());
    }

    public function test_air_alert_is_yellow_when_only_drones_are_on_radar(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $user = User::factory()->create();
        $user->mergePref(['alert_region' => 'zhytomyr']);
        $watcher = app(AlertWatcher::class);
        $watcher->run();
        // На радарі в області — лише шахед: повітряна тривога жовтого рівня.
        AirThreat::query()->create(['type' => 'uav', 'region_slug' => 'zhytomyr', 'place_name' => 'Житомир', 'title' => 'Шахед', 'lat' => 50.25, 'lng' => 28.66, 'detected_at' => now(), 'expires_at' => now()->addMinutes(10)]);
        Cache::forget('alerts.state');
        [$alerts, $index] = [[$this->row('10', 'State', 'AIR')], 2];
        $this->assertSame(1, $watcher->run());
        $data = $user->notifications()->first()->data;
        $this->assertSame(['yellow', 'yellow', '#F59E0B'], [$data['severity'], $data['air_level'], $data['accent']]);
        $this->assertSame('Повітряна тривога (жовтий рівень · БпЛА): Житомирська область', $data['text']);
        // На мапі — теж жовтий рівень.
        Cache::forget('alerts.state');
        $region = collect($this->service()->state()['regions'])->firstWhere('slug', 'zhytomyr');
        $this->assertSame(['UAV', 'yellow'], [$region['alert'], $region['air_level']]);
    }

    public function test_place_tree_search_and_exact_status_like_tryvoga_app(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $user = User::factory()->create(['country' => 'UA']);

        // Повне дерево: район → громада → місто.
        $this->actingAs($user)->getJson('/alerts/units?region=zhytomyr')->assertOk()
            ->assertJsonPath('tree.0.name', 'Житомирський район')
            ->assertJsonPath('tree.0.children.0.children.0.name', 'м. Житомир')
            ->assertJsonPath('tree.0.children.0.children.0.type', 'CityOrVillage');
        // Екран вибору як у «Тривозі»: області → райони → громади → міста.
        $this->actingAs($user)->getJson('/alerts/places')->assertOk()->assertJsonPath('places.0.name', 'Житомирська область')->assertJsonPath('places.0.has_children', true);
        $this->actingAs($user)->getJson('/alerts/places?parent=10')->assertOk()
            ->assertJsonPath('parent.type', 'State')
            ->assertJsonPath('places.0.name', 'Житомирський район')
            ->assertJsonPath('places.1.has_children', false);
        // Обрати всю область (id області) — без окремого місця.
        $this->actingAs($user)->putJson('/alerts/preferences', ['unit' => '10'])->assertOk()
            ->assertJsonPath('prefs.region', 'zhytomyr')->assertJsonPath('prefs.unit', null);
        // Пошук за назвою — з шляхом.
        $this->actingAs($user)->getJson('/alerts/search?q=житомир')->assertOk()
            ->assertJsonPath('places.0.name', 'м. Житомир')
            ->assertJsonPath('places.0.path', 'Житомирська область · Житомирський район · Житомирська територіальна громада');

        // Обрали місто; тривога лише в Коростенському районі — у місті спокійно.
        $this->actingAs($user)->putJson('/alerts/preferences', ['unit' => '10011'])->assertOk()
            ->assertJsonPath('prefs.region', 'zhytomyr')
            ->assertJsonPath('prefs.unit.type_label', 'Населений пункт')
            ->assertJsonPath('prefs.unit.path_ids', ['10', '100', '1001', '10011']);
        [$alerts, $index] = [[$this->row('200', 'District', 'AIR')], 2];
        app(UkraineAlarm::class)->active();
        $this->actingAs($user)->getJson('/alerts/state')->assertJsonPath('prefs.status', []);
        // Тривога в Житомирському районі — діє й на місто.
        [$alerts, $index] = [[$this->row('100', 'District', 'AIR')], 3];
        app(UkraineAlarm::class)->active();
        $this->actingAs($user)->getJson('/alerts/state')->assertJsonPath('prefs.status.0.type', 'AIR')
            ->assertJsonPath('prefs.status.0.accent', '#EF4444');
    }

    public function test_extra_places_notify_with_label_and_keep_my_shelter(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $user = User::factory()->create(['country' => 'UA']);
        $this->actingAs($user)->putJson('/alerts/preferences', ['unit' => '1001', 'places' => [['id' => '200', 'label' => 'Мама']]])->assertOk()
            ->assertJsonPath('prefs.places.0.name', 'Коростенський район')
            ->assertJsonPath('prefs.places.0.label', 'Мама')
            ->assertJsonPath('prefs.places.0.status', []);
        $this->actingAs($user)->putJson('/alerts/preferences', ['places' => [['id' => 'nope']]])->assertStatus(422);
        $watcher = app(AlertWatcher::class);
        $watcher->run();

        // Тривога лише в Коростенському районі (у мами) — сповіщення з підписом, у мене тихо.
        [$alerts, $index] = [[$this->row('200', 'District', 'AIR')], 2];
        $this->assertSame(1, $watcher->run());
        $this->assertSame('Мама — Повітряна тривога (червоний рівень): Коростенський район', $user->notifications()->first()->data['text']);

        // Я в укритті у себе; відбій у мами не знімає мій статус.
        $this->actingAs($user)->putJson('/alerts/preferences', ['shelter' => true])->assertOk();
        [$alerts, $index] = [[], 3];
        $this->assertSame(1, $watcher->run());
        $this->assertSame('🛡️', $user->fresh()->status_emoji);
    }

    public function test_alert_history_of_my_place(): void
    {
        app(SiteSettings::class)->putSecret('ukrainealarm_token', 'ua-alarm-key-1234567890');
        Http::fake(function ($request) {
            $url = $request->url();
            if (str_contains($url, '/regions')) {
                return Http::response($this->zhytomyrTree());
            }
            if (str_contains($url, '/alerts/regionHistory')) {
                return Http::response([['regionId' => '100', 'regionName' => 'Житомирський район', 'alarms' => [
                    ['regionId' => '100', 'startDate' => now()->subDays(1)->subMinutes(70)->toIso8601String(), 'endDate' => now()->subDays(1)->toIso8601String(), 'alertType' => 'AIR', 'isContinue' => false],
                    ['regionId' => '100', 'startDate' => now()->subDays(10)->toIso8601String(), 'endDate' => now()->subDays(10)->addMinutes(30)->toIso8601String(), 'alertType' => 'ARTILLERY', 'isContinue' => false],
                ]]]);
            }

            return Http::response([]);
        });
        $user = User::factory()->create(['country' => 'UA']);
        $this->actingAs($user)->getJson('/alerts/history')->assertOk()->assertJsonPath('place', null);
        $user->mergePref(['alert_region' => 'zhytomyr', 'alert_unit' => '100']);
        $this->actingAs($user)->getJson('/alerts/history')->assertOk()
            ->assertJsonPath('place', 'Житомирський район')
            ->assertJsonPath('alarms.0.type', 'AIR')
            ->assertJsonPath('alarms.0.minutes', 70)
            ->assertJsonPath('alarms.1.accent', '#F97316')
            ->assertJsonPath('week.count', 1)
            ->assertJsonPath('week.minutes', 70);
    }

    public function test_official_alert_level_yellow_then_raised_to_red(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $user = User::factory()->create();
        $user->mergePref(['alert_region' => 'zhytomyr']);
        $watcher = app(AlertWatcher::class);
        $watcher->run();
        $at = now()->toIso8601String();
        $air = fn (string $level, string $created) => ['regionId' => '10', 'regionType' => 'State', 'regionName' => 'Житомирська область', 'activeAlerts' => [[
            'regionId' => '10', 'regionType' => 'State', 'type' => 'AIR', 'lastUpdate' => $at,
            'activeAlertLevels' => [['alertLevel' => $level, 'reason' => 'test', 'createdAt' => $created]],
        ]]];

        // Офіційний рівень Yellow з API (радар порожній) — жовта тривога.
        [$alerts, $index] = [[$air('Yellow', now()->toIso8601String())], 2];
        $this->assertSame(1, $watcher->run());
        $data = $user->notifications()->first()->data;
        $this->assertSame(['yellow', '#F59E0B'], [$data['air_level'], $data['accent']]);
        Cache::forget('alerts.state');
        $this->assertSame('yellow', collect($this->service()->state()['regions'])->firstWhere('slug', 'zhytomyr')['air_level']);

        // API підвищив рівень до Red — та сама картка оновлюється, один пуш «рівень підвищено».
        [$alerts, $index] = [[$air('Red', now()->addSecond()->toIso8601String())], 3];
        $this->assertSame(1, $watcher->run());
        $this->assertSame(1, $user->notifications()->count());
        $row = $user->notifications()->first()->data;
        $this->assertSame(['red', '#EF4444', true], [$row['air_level'], $row['accent'], $row['raised']]);
        $this->assertSame('Повітряна тривога · Житомирська область: рівень підвищено до червоного', $row['text']);
        // Повтор того самого стану — нічого.
        $index = 4;
        $this->assertSame(0, $watcher->run());
    }

    public function test_webhook_only_signals_and_cleanup_removes_old_duplicates(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $user = User::factory()->create();
        $user->mergePref(['alert_region' => 'zhytomyr']);
        app(AlertWatcher::class)->run();

        // Підпис RSA SHA-256 як в UkraineAlarm: «{timestamp}.{сире тіло}», Base64.
        $pair = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        config(['services.ukraine_alarm.webhook_key' => openssl_pkey_get_details($pair)['key']]);
        $send = function (array $body, ?int $ts = null, $key = null) use ($pair) {
            $raw = json_encode($body);
            $ts ??= time();
            openssl_sign($ts.'.'.$raw, $sig, $key ?? $pair, OPENSSL_ALGO_SHA256);

            return $this->call('POST', '/api/webhooks/ukraine-alarm', [], [], [], [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_WEBHOOK_SIGNATURE' => base64_encode($sig),
                'HTTP_X_WEBHOOK_TIMESTAMP' => (string) $ts,
                'HTTP_X_WEBHOOK_SIGNATURE_ALG' => 'rsa-sha256',
            ], $raw);
        };
        // Без підпису, чужим ключем чи зі старим часом — 401.
        $this->postJson('/api/webhooks/ukraine-alarm', ['regionId' => 10])->assertStatus(401);
        $send(['regionId' => 10], null, openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]))->assertStatus(401);
        $send(['regionId' => 10], time() - 600)->assertStatus(401)->assertJsonPath('reason', 'stale');

        // Підписаний вебхук — лише сигнал: «тривога» в тілі без підтвердження API нічого не створює.
        $send(['regionId' => 10, 'alarmType' => 'AIR', 'status' => 'Activate', 'alertLevel' => 'Red'])->assertOk();
        $this->assertSame(0, $user->notifications()->count());
        [$alerts, $index] = [[$this->row('10', 'State', 'AIR')], 2];
        $send(['regionId' => 10, 'n' => 1])->assertOk();
        $send(['regionId' => 10, 'n' => 2])->assertOk();
        $this->assertSame(1, $user->notifications()->count());

        // Старі дублі (без alert_key) прибирає команда; нові лишаються.
        foreach (range(1, 4) as $i) {
            $user->notifications()->create(['id' => (string) Str::uuid(), 'type' => AirAlertNotice::class, 'data' => ['kind' => 'air_alert', 'text' => 'Повітряна тривога: Житомирська область']]);
        }
        $this->artisan('alerts:clean-notifications')->assertOk();
        $this->assertSame(1, $user->notifications()->count());
    }

    public function test_only_for_ukraine_and_preferences_set_shelter_status(): void
    {
        Http::fake(['*' => Http::response(['states' => []])]);
        $foreign = User::factory()->create(['country' => 'PL']);
        $this->actingAs($foreign)->get('/alerts')->assertNotFound();

        $user = User::factory()->create(['country' => 'UA']);
        $this->actingAs($user)->get('/alerts')->assertInertia(fn (Assert $p) => $p->component('alerts/index')->has('state.regions', 26)->where('prefs.region', null));
        $this->actingAs($user)->putJson('/alerts/preferences', ['region' => 'lviv', 'push' => false, 'shelter' => true])
            ->assertOk()->assertJsonPath('prefs.region', 'lviv')->assertJsonPath('prefs.push', false)->assertJsonPath('prefs.shelter', true);
        $this->assertSame('🛡️', $user->fresh()->status_emoji);
        $this->actingAs($user)->putJson('/alerts/preferences', ['shelter' => false])->assertJsonPath('prefs.shelter', false);
        $this->assertNull($user->fresh()->status_emoji);
        $this->actingAs($user)->putJson('/alerts/preferences', ['region' => 'atlantis'])->assertStatus(422);

        // Іноземець, що сам обрав область (гість України), бачить мапу.
        $foreign->mergePref(['alert_region' => 'odesa']);
        $this->actingAs($foreign)->getJson('/alerts/state')->assertOk()->assertJsonPath('prefs.region', 'odesa');
    }

    public function test_expired_threats_are_hidden(): void
    {
        Http::fake(['*' => Http::response(['states' => []])]);
        AirThreat::query()->create(['type' => 'uav', 'title' => 'old', 'lat' => 50, 'lng' => 30, 'detected_at' => now()->subHour(), 'expires_at' => now()->subMinutes(5)]);
        AirThreat::query()->create(['type' => 'missile', 'title' => 'new', 'lat' => 50, 'lng' => 30, 'detected_at' => now(), 'expires_at' => CarbonImmutable::now()->addMinutes(5)]);
        $state = $this->service()->state();
        $this->assertCount(1, $state['threats']);
        $this->assertSame('missile', $state['threats'][0]['type']);
    }

    public function test_sources_confirm_same_threat_and_raise_confidence(): void
    {
        $at = CarbonImmutable::now()->subMinutes(5);
        $this->assertTrue($this->service()->ingest(['ref' => 'monitor_ukr/5', 'channel' => 'monitor_ukr', 'text' => 'Шахеди на Полтаву', 'at' => $at]));
        $threat = AirThreat::query()->sole();
        $this->assertSame(25, $threat->confidence);

        // Той самий БпЛА з офіційного й регіонального каналу — не дубль, а підтвердження.
        $this->assertFalse($this->service()->ingest(['ref' => 'kpszsu/9', 'channel' => 'kpszsu', 'text' => 'БпЛА курсом на Полтаву', 'at' => $at->addMinute()]));
        $this->assertFalse($this->service()->ingest(['ref' => 'PoltavaRadar/3', 'channel' => 'PoltavaRadar', 'text' => 'Шахед над Полтавою', 'at' => $at->addMinutes(2)]));
        $threat->refresh();
        $this->assertSame(1, AirThreat::query()->count());
        $this->assertSame(100, $threat->confidence);
        $this->assertSame(['monitor_ukr', 'kpszsu', 'PoltavaRadar'], $threat->sources);

        // Регіональний канал без назви місця — мітка в його області.
        $this->assertTrue($this->service()->ingest(['ref' => 'kherson_non_drone/1', 'channel' => 'kherson_non_drone', 'text' => 'Увага! Дрон над містом', 'at' => $at]));
        $this->assertSame('kherson', AirThreat::query()->latest('id')->first()->region_slug);

        // Каталог джерел: групи й канали, без вимкнених груп.
        app(SiteSettings::class)->put(['alerts_source_groups' => 'official,regional']);
        $channels = $this->service()->channels();
        $this->assertContains('kpszsu', $channels);
        $this->assertContains('PoltavaRadar', $channels);
        $this->assertNotContains('monitor_ukr', $channels);
        $groups = collect($this->service()->sources())->keyBy('group');
        $this->assertTrue($groups['official']['enabled']);
        $this->assertFalse($groups['aggregators']['enabled']);
    }

    public function test_official_ukraine_alarm_api_goes_first(): void
    {
        Http::fake([
            'api.ukrainealarm.com/*' => Http::response([
                ['regionId' => '14', 'regionType' => 'State', 'regionName' => 'Київська область', 'activeAlerts' => [['type' => 'AIR', 'lastUpdate' => now()->subMinutes(7)->toIso8601String()]]],
                ['regionId' => '31', 'regionType' => 'State', 'regionName' => 'м. Київ', 'activeAlerts' => []],
            ]),
            '*' => Http::response(['states' => []]),
        ]);
        app(SiteSettings::class)->putSecret('ukrainealarm_token', 'ua-alarm-key-1234567890');
        $state = $this->service()->state();
        $this->assertSame('UkraineAlarm', $state['source']);
        $this->assertSame(1, $state['active_count']);
        $this->assertSame('air_raid', collect($state['regions'])->firstWhere('slug', 'kyiv-oblast')['type']);
    }

    public function test_alerts_by_raion_and_hromada_with_kinds(): void
    {
        $alerts = [
            ['regionId' => '141', 'regionType' => 'District', 'regionName' => 'Бучанський район', 'activeAlerts' => [['regionId' => '141', 'regionType' => 'District', 'type' => 'AIR', 'lastUpdate' => now()->subMinutes(5)->toIso8601String()]]],
            ['regionId' => '911', 'regionType' => 'Community', 'regionName' => 'Нікопольська територіальна громада', 'activeAlerts' => [['regionId' => '911', 'regionType' => 'Community', 'type' => 'ARTILLERY', 'lastUpdate' => now()->toIso8601String()]]],
            ['regionId' => '16', 'regionType' => 'State', 'regionName' => 'Луганська область', 'activeAlerts' => [['regionId' => '16', 'regionType' => 'State', 'type' => 'AIR', 'lastUpdate' => now()->subDays(900)->toIso8601String()]]],
            ['regionId' => '181', 'regionType' => 'District', 'regionName' => 'Шосткинський район', 'activeAlerts' => [['regionId' => '181', 'regionType' => 'District', 'type' => 'CHEMICAL', 'lastUpdate' => now()->toIso8601String()]]],
        ];
        $index = 1;
        $this->fakeUkraineAlarm(['states' => [
            ['regionId' => '14', 'regionName' => 'Київська область', 'regionType' => 'State', 'regionChildIds' => [['regionId' => '141', 'regionName' => 'Бучанський район', 'regionType' => 'District', 'regionChildIds' => []]]],
            ['regionId' => '9', 'regionName' => 'Дніпропетровська область', 'regionType' => 'State', 'regionChildIds' => [['regionId' => '91', 'regionName' => 'Нікопольський район', 'regionType' => 'District', 'regionChildIds' => [['regionId' => '911', 'regionName' => 'Нікопольська територіальна громада', 'regionType' => 'Community', 'regionChildIds' => []]]]]],
            ['regionId' => '16', 'regionName' => 'Луганська область', 'regionType' => 'State', 'regionChildIds' => []],
            ['regionId' => '18', 'regionName' => 'Сумська область', 'regionType' => 'State', 'regionChildIds' => [['regionId' => '181', 'regionName' => 'Шосткинський район', 'regionType' => 'District', 'regionChildIds' => []]]],
        ]], $alerts, $index);
        $state = $this->service()->state();
        $units = collect($state['units'])->keyBy('code');
        $regions = collect($state['regions'])->keyBy('slug');

        // Район — лише він, а область — часткова тривога.
        $this->assertSame('air_raid', $units['UA32080000000084076']['kind']);
        $this->assertSame('partial', $regions['kyiv-oblast']['type']);
        // Громада з артобстрілом.
        $this->assertSame('artillery', $units['UA12080050000062712']['kind']);
        // Уся область — усі її райони.
        $this->assertSame(8, $units->filter(fn ($u, $code) => str_starts_with($code, 'UA44'))->count());
        $this->assertSame('air_raid', $regions['luhansk']['type']);
        // Хімічна загроза — свій вид.
        $this->assertSame('chemical', $units['UA59100000000036457']['kind']);
        $this->assertSame('chemical', $regions['sumy']['type']);
    }

    public function test_neptun_open_api_without_keys(): void
    {
        Http::fake([
            'neptun.in.ua/api/v1/alerts' => Http::response([
                'raions' => [['key' => 'odeska:odeskyi', 'name' => 'Одеський район'], ['key' => 'kyivska:buchanskyi']],
                'oblasts' => [['key' => 'krymska', 'name' => 'Автономна Республіка Крим']],
            ]),
            'neptun.in.ua/api/v1/threats' => Http::response([
                'serverTime' => now()->toIso8601String(),
                'threats' => [
                    ['id' => 'trk_1a2b', 'type' => 'uav', 'title' => 'Шахед', 'region' => 'Одеська область', 'district' => 'Одеський район', 'locality' => 'Чорноморськ',
                        'lat' => 46.30, 'lon' => 30.65, 'heading' => 42, 'confidenceLevel' => 'high', 'sourceCount' => 3, 'count' => 2,
                        'updatedAt' => now()->subMinute()->toIso8601String(), 'status' => 'active', 'explanationShort' => 'БпЛА курсом на Чорноморськ',
                        'velocity' => ['bearingDeg' => 42, 'speedKmh' => 170], 'confirmedAt' => now()->subMinutes(5)->toIso8601String(),
                        'uncertaintyKm' => 4, 'positionQuality' => 'confirmed', 'advisory' => false, 'areaOnly' => false],
                    ['id' => 'trk_area', 'type' => 'missile', 'title' => 'Ракета', 'region' => 'Одеська область', 'lat' => 46.8, 'lon' => 30.2,
                        'confidenceLevel' => 'low', 'sourceCount' => 1, 'areaOnly' => true, 'heading' => 90],
                ],
            ]),
            'neptun.in.ua/api/v1/messages' => Http::response(['messages' => [['channel' => 'kpszsu', 'text' => 'БпЛА на Одещину', 'date' => now()->toIso8601String()]]]),
            '*' => Http::response(['states' => []]),
        ]);
        $state = $this->service()->state();

        // Тривоги NEPTUN більше не беремо — лише UkraineAlarm; NEPTUN дає тільки цілі на радар.
        $this->assertNull($state['source']);
        $this->assertSame('Дані: Карта повітряних загроз NEPTUN', $state['attribution']['text']);
        $this->assertFalse(collect($state['regions'])->firstWhere('slug', 'odesa')['active']);

        $shahed = collect($state['threats'])->firstWhere('place', 'Чорноморськ');
        $this->assertSame('uav', $shahed['type']);
        $this->assertSame('shahed', $shahed['variant']);
        $this->assertSame(42, $shahed['course']);
        $this->assertSame(170, $shahed['speed']);
        $this->assertSame(2, $shahed['count']);
        $this->assertSame(90, $shahed['confidence']);
        $this->assertCount(3, $shahed['sources']);
        // Лише область — без курсу й руху.
        $area = collect($state['threats'])->firstWhere('type', 'missile');
        $this->assertTrue($area['area_only']);
        $this->assertNull($area['course']);
        $this->assertSame(0, $area['speed']);
        $this->assertSame('kpszsu', $state['feed'][0]['channel']);

        // Вимкнено в налаштуваннях — NEPTUN не питаємо.
        app(SiteSettings::class)->put(['alerts_neptun' => '0']);
        Cache::forget('alerts.state');
        $this->assertNull($this->service()->state()['attribution'] ?? null);
    }

    public function test_visibility_modes_and_source_diagnostics(): void
    {
        Http::fake([
            'neptun.in.ua/api/v1/alerts' => Http::response(['raions' => [], 'oblasts' => [['key' => 'krymska']]]),
            'neptun.in.ua/api/v1/threats' => Http::response(['threats' => []]),
            '*' => Http::response(['states' => []]),
        ]);
        $foreign = User::factory()->create(['country' => 'PL', 'locale' => 'en']);
        $admin = User::factory()->admin()->create(['country' => 'PL', 'locale' => 'en']);
        $speaker = User::factory()->create(['country' => null, 'locale' => 'uk']);
        $this->actingAs($foreign)->getJson('/alerts/state')->assertNotFound();
        // Українська мова інтерфейсу — теж ознака (IP може не визначитись).
        $this->actingAs($speaker)->getJson('/alerts/state')->assertOk();

        app(SiteSettings::class)->put(['alerts_visibility' => 'admins']);
        $this->actingAs($speaker)->getJson('/alerts/state')->assertNotFound();
        $this->actingAs($admin)->getJson('/alerts/state')->assertOk();
        app(SiteSettings::class)->put(['alerts_visibility' => 'all']);
        $this->actingAs($foreign)->getJson('/alerts/state')->assertOk();

        // Перевірка в адмінці: без ключа UkraineAlarm тривог немає, тост це каже.
        $this->actingAs($admin)->post('/admin/integrations/cinema/air_alerts/test')->assertRedirect();
        $toast = session('inertia.flash_data.toast') ?? session('inertia.flash.toast') ?? collect(session()->all())->flatten(5)->first(fn ($v) => is_string($v) && str_contains($v, 'NEPTUN'));
        $message = is_array($toast) ? $toast['message'] : (string) $toast;
        $this->assertStringContainsString('UkraineAlarm: немає ключа', $message);
        $this->assertStringContainsString('✅ NEPTUN цілі', $message);
        $this->assertStringContainsString('UkraineAlarm зараз не відповідає', $message);
    }

    public function test_alert_types_priority_scale_and_threat_levels(): void
    {
        $this->assertSame(AlertType::AIR, AlertType::fromApi('air_raid'));
        $this->assertSame(AlertType::ARTILLERY, AlertType::fromApi('artillery_shelling'));
        $this->assertSame(AlertType::NUCLEAR, AlertType::fromApi('NUCLEAR'));
        $this->assertSame(AlertScale::HROMADA, AlertScale::fromApi('Community'));
        $this->assertSame('#E11D48', AlertType::AIR->colors(AlertScale::RAION)['hex']);

        $alerts = [
            $this->row('18', 'State', 'AIR'),
            ['regionId' => '181', 'regionType' => 'District', 'regionName' => 'Шосткинський район', 'activeAlerts' => [['regionId' => '181', 'regionType' => 'District', 'type' => 'CHEMICAL', 'lastUpdate' => now()->toIso8601String()]]],
            ['regionId' => '141', 'regionType' => 'District', 'regionName' => 'Бучанський район', 'activeAlerts' => [['regionId' => '141', 'regionType' => 'District', 'type' => 'AIR', 'lastUpdate' => now()->toIso8601String()]]],
        ];
        $alerts[0]['regionName'] = 'Сумська область';
        $index = 1;
        $this->fakeUkraineAlarm(['states' => [
            ['regionId' => '14', 'regionName' => 'Київська область', 'regionType' => 'State', 'regionChildIds' => [['regionId' => '141', 'regionName' => 'Бучанський район', 'regionType' => 'District', 'regionChildIds' => []]]],
            ['regionId' => '9', 'regionName' => 'Дніпропетровська область', 'regionType' => 'State', 'regionChildIds' => [['regionId' => '91', 'regionName' => 'Нікопольський район', 'regionType' => 'District', 'regionChildIds' => [['regionId' => '911', 'regionName' => 'Нікопольська територіальна громада', 'regionType' => 'Community', 'regionChildIds' => []]]]]],
            ['regionId' => '16', 'regionName' => 'Луганська область', 'regionType' => 'State', 'regionChildIds' => []],
            ['regionId' => '18', 'regionName' => 'Сумська область', 'regionType' => 'State', 'regionChildIds' => [['regionId' => '181', 'regionName' => 'Шосткинський район', 'regionType' => 'District', 'regionChildIds' => []]]],
        ]], $alerts, $index);
        AirThreat::query()->create(['type' => 'ballistic', 'region_slug' => 'kharkiv', 'place_name' => 'Харків', 'title' => 'Балістика', 'lat' => 50, 'lng' => 36.2, 'detected_at' => now(), 'expires_at' => now()->addMinutes(5)]);
        AirThreat::query()->create(['type' => 'uav', 'region_slug' => 'sumy', 'place_name' => 'Суми', 'title' => 'Шахед', 'lat' => 50.9, 'lng' => 34.8, 'detected_at' => now(), 'expires_at' => now()->addMinutes(5)]);
        $state = $this->service()->state();
        $regions = collect($state['regions'])->keyBy('slug');

        // Хімічна (90) важливіша за повітряну (70) й БпЛА (40); решта — вторинні бейджі.
        $this->assertSame('CHEMICAL', $regions['sumy']['alert']);
        // Повітряна тривога, а на радарі лише шахед — жовтий рівень (UAV) замість червоного.
        $this->assertSame(['CHEMICAL', 'UAV'], $regions['sumy']['alerts']);
        $this->assertSame('yellow', $regions['sumy']['air_level']);
        $this->assertSame('oblast', $regions['sumy']['scale']);
        // Тривога лише в районі — масштаб «район», колір заливки району.
        $this->assertSame('AIR', $regions['kyiv-oblast']['alert']);
        $this->assertSame('raion', $regions['kyiv-oblast']['scale']);
        $unit = collect($state['units'])->firstWhere('code', 'UA32080000000084076');
        $this->assertSame(['AIR', 'raion'], [$unit['type'], $unit['scale']]);
        // Без офіційної тривоги, але з балістикою — червоний рівень; спокійна область — CLEAR.
        $this->assertSame('BALLISTIC', $regions['kharkiv']['alert']);
        $this->assertSame(['BALLISTIC'], $regions['kharkiv']['threat_levels']);
        $this->assertSame('CLEAR', $regions['lviv']['alert']);
    }

    public function test_admin_alerts_dashboard_shows_health_now_and_recent(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $user = User::factory()->create(['country' => 'UA']);
        $this->actingAs($user)->putJson('/alerts/preferences', ['unit' => '1001'])->assertOk();
        $watcher = app(AlertWatcher::class);
        $watcher->run();
        [$alerts, $index] = [[$this->row('100', 'District', 'AIR')], 2];
        $this->assertSame(1, $watcher->run());

        $this->withoutVite();
        $admin = User::factory()->admin()->create();
        $this->actingAs($user)->get('/admin/alerts')->assertForbidden();
        $this->actingAs($admin)->get('/admin/alerts')->assertOk()->assertInertia(fn ($page) => $page
            ->component('admin/alerts')
            ->where('enabled', true)
            ->where('health.tick_fresh', true)
            ->where('health.index', 2)
            ->where('now_total', 1)
            ->where('now.0.name', 'Житомирський район')
            ->where('now.0.alerts.0.type', 'AIR')
            ->where('subscribers.total', 1)
            ->where('subscribers.top.0.name', 'Житомирська територіальна громада')
            ->where('sent.day', 1)
            ->where('recent.0.users', 1));

        // Дії пишуться в журнал.
        Log::spy();
        $this->actingAs($admin)->post('/admin/alerts/check')->assertRedirect();
        Log::shouldHaveReceived('info')->withArgs(fn ($msg) => $msg === 'admin.alerts.check')->once();
        $this->actingAs($admin)->post('/admin/alerts/webhook', ['action' => 'nope'])->assertSessionHasErrors('action');
    }

    public function test_family_bot_posts_alert_start_and_end_for_chosen_place(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $server = GtaServer::query()->create(['slug' => 'quant', 'name' => 'Quant', 'platform' => 'pc', 'multiplayer' => 'ragemp', 'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed']);
        $owner = User::factory()->create();
        $family = app(FamilyService::class)->create($owner, ['server_id' => $server->id, 'name' => 'Scaletta', 'tag' => 'SCL', 'rp_nickname' => 'Marco_Scaletta', 'static_id' => '1']);
        $family->update(['webhooks' => ['discord' => 'https://discord.com/api/webhooks/1/abc']]);

        // Місце з довідника; неіснуюче — відмова.
        $this->actingAs($owner)->put("/f/{$family->slug}/settings/webhooks", ['alerts' => '999'])->assertStatus(422);
        $this->actingAs($owner)->put("/f/{$family->slug}/settings/webhooks", ['alerts' => '1001'])->assertSessionHasNoErrors();
        $this->assertSame('1001', $family->fresh()->webhook('alerts'));
        $this->assertSame([['1001' => [$family->id]]], [AlertWatcher::familyWatchers()]);

        $watcher = app(AlertWatcher::class);
        $watcher->run();
        $discord = fn () => Http::recorded()->filter(fn ($pair) => str_contains($pair[0]->url(), 'discord.com'))->values();
        [$alerts, $index] = [[$this->row('100', 'District', 'AIR')], 2];
        $watcher->run();
        $watcher->run(force: true); // вебхук слідом — без дубля
        $this->assertCount(1, $discord());
        $this->assertStringContainsString('🔴 Повітряна тривога (червоний рівень): Житомирська територіальна громада', json_encode($discord()[0][0]->data(), JSON_UNESCAPED_UNICODE));

        [$alerts, $index] = [[], 3];
        $watcher->run();
        $this->assertCount(2, $discord());
        $this->assertStringContainsString('🟢 Відбій повітряної тривоги', json_encode($discord()[1][0]->data(), JSON_UNESCAPED_UNICODE));

        // Вимкнули — більше не стежимо.
        $this->actingAs($owner)->put("/f/{$family->slug}/settings/webhooks", ['clear' => 'alerts'])->assertSessionHasNoErrors();
        $this->assertSame([], AlertWatcher::familyWatchers());
    }

    public function test_hush_holds_social_pushes_while_my_place_is_under_alert(): void
    {
        $alerts = [];
        $index = 1;
        $this->fakeUkraineAlarm($this->zhytomyrTree(), $alerts, $index);
        $user = User::factory()->create(['country' => 'UA']);
        $this->actingAs($user)->putJson('/alerts/preferences', ['unit' => '1001'])->assertOk()->assertJsonPath('prefs.hush', true);
        $watcher = app(AlertWatcher::class);
        $watcher->run();
        $notification = fn () => $user->notifications()->create(['id' => (string) Str::uuid(), 'type' => 'test', 'data' => ['kind' => 'friend_request', 'text' => 'Нова заявка']]);

        [$alerts, $index] = [[$this->row('100', 'District', 'AIR')], 2];
        $watcher->run();
        $this->assertTrue($watcher->hushed($user));
        // Тривога в сусідньому районі — не моя.
        $other = User::factory()->create(['country' => 'UA']);
        $this->actingAs($other)->putJson('/alerts/preferences', ['unit' => '200'])->assertOk();
        $this->assertFalse($watcher->hushed($other->fresh()));

        // Вимкнули «Тишу» — пуші йдуть і під час тривоги.
        $this->actingAs($user)->putJson('/alerts/preferences', ['hush' => false])->assertOk();
        $this->assertFalse($watcher->hushed($user->fresh()));
        $this->actingAs($user)->putJson('/alerts/preferences', ['hush' => true])->assertOk();

        [$alerts, $index] = [[], 3];
        $watcher->run();
        $this->assertFalse($watcher->hushed($user->fresh()));
        $this->assertNotNull($notification());
    }
}
