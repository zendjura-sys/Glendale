<?php

namespace Tests\Feature;

use App\Enums\AlertScale;
use App\Enums\AlertType;
use App\Models\AirThreat;
use App\Models\User;
use App\Services\Alerts\AirAlertChannel;
use App\Services\Alerts\AirAlertService;
use App\Support\Settings\SiteSettings;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AirAlertsTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_state_uses_alerts_in_ua_and_falls_back_to_ubilling(): void
    {
        Http::fake([
            'api.alerts.in.ua/*' => Http::response(['alerts' => [
                ['location_title' => 'Харківська область', 'location_type' => 'oblast', 'location_oblast' => 'Харківська область', 'alert_type' => 'air_raid', 'started_at' => now()->subMinutes(20)->toIso8601String()],
                ['location_title' => 'Нікопольський район', 'location_type' => 'raion', 'location_oblast' => 'Дніпропетровська область', 'alert_type' => 'artillery_shelling', 'started_at' => now()->toIso8601String()],
            ]]),
            'ubilling.net.ua/*' => Http::response(['states' => ['Сумська область' => ['alertnow' => true, 'changed' => now()->toDateTimeString()]]]),
            // Без підміни тест ходив би до справжніх NEPTUN і Telegram (у CI мережа є).
            'neptun.in.ua/*' => Http::response(null, 503),
            't.me/*' => Http::response(null, 503),
        ]);
        app(SiteSettings::class)->putSecret('alerts_in_ua_token', 'test-token-1234567890');
        $state = $this->service()->state();
        $kharkiv = collect($state['regions'])->firstWhere('slug', 'kharkiv');
        $this->assertTrue($kharkiv['active']);
        $this->assertSame('air_raid', $kharkiv['type']);
        $this->assertGreaterThanOrEqual(19, $kharkiv['minutes']);
        $this->assertSame('artillery', collect($state['regions'])->firstWhere('slug', 'dnipropetrovsk')['type']);
        $this->assertSame('alerts.in.ua', $state['source']);
        $this->assertCount(26, $state['regions']);

        app(SiteSettings::class)->putSecret('alerts_in_ua_token', null);
        Cache::forget('alerts.state');
        $state = $this->service()->state();
        $this->assertSame('ubilling', $state['source']);
        $this->assertTrue(collect($state['regions'])->firstWhere('slug', 'sumy')['active']);
        $this->assertSame(1, $state['active_count']);
    }

    public function test_sync_reads_channel_and_notifies_region_changes(): void
    {
        $at = now()->subMinutes(3)->toIso8601String();
        $html = '<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="kpszsu/101">'
            .'<div class="tgme_widget_message_text js-message_text" dir="auto">БпЛА з Чернігівщини курсом на Київщину</div>'
            .'<time datetime="'.$at.'" class="time">10:00</time></div></div>';
        $states = ['states' => ['Київська область' => ['alertnow' => false]]];
        Http::fake(function ($request) use ($html, &$states) {
            return str_contains($request->url(), 't.me') ? Http::response($html) : Http::response($states);
        });
        $user = User::factory()->create();
        $user->mergePref(['alert_region' => 'kyiv-oblast']);

        $this->artisan('alerts:sync')->assertOk();
        $this->assertSame(1, AirThreat::query()->count());
        $threat = AirThreat::query()->first();
        $this->assertSame('uav', $threat->type);
        $this->assertSame('chernihiv', $threat->region_slug);
        $this->assertSame(0, $user->notifications()->count());

        // Тривога почалась — сповіщення; повторний запуск без змін — нічого.
        $states = ['states' => ['Київська область' => ['alertnow' => true, 'changed' => now()->toDateTimeString()]]];
        $this->artisan('alerts:sync')->assertOk();
        $this->artisan('alerts:sync')->assertOk();
        $this->assertSame(1, AirThreat::query()->count());
        $this->assertSame(1, $user->notifications()->count());
        $this->assertSame('air_alert', $user->notifications()->first()->data['kind']);
        $this->assertCount(1, $this->service()->state()['feed']);

        // Відбій.
        $states = ['states' => ['Київська область' => ['alertnow' => false]]];
        $this->artisan('alerts:sync')->assertOk();
        $this->assertSame(2, $user->notifications()->count());
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
        Http::fake([
            'api.alerts.in.ua/*' => Http::response(['alerts' => [
                ['location_type' => 'raion', 'location_title' => 'Бучанський район', 'location_oblast' => 'Київська область', 'alert_type' => 'air_raid', 'started_at' => now()->subMinutes(5)->toIso8601String()],
                ['location_type' => 'hromada', 'location_title' => 'Нікопольська територіальна громада', 'location_oblast' => 'Дніпропетровська область', 'alert_type' => 'artillery_shelling', 'started_at' => now()->toIso8601String()],
                ['location_type' => 'oblast', 'location_title' => 'Луганська область', 'location_oblast' => 'Луганська область', 'alert_type' => 'air_raid', 'started_at' => now()->subDays(900)->toIso8601String()],
                ['location_type' => 'raion', 'location_title' => 'Шосткинський район', 'location_oblast' => 'Сумська область', 'alert_type' => 'chemical', 'started_at' => now()->toIso8601String()],
            ]]),
            '*' => Http::response(['states' => []]),
        ]);
        app(SiteSettings::class)->putSecret('alerts_in_ua_token', 'test-token-1234567890');
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

    public function test_status_without_key_from_official_channel(): void
    {
        $post = fn (int $id, string $text, int $minutesAgo) => '<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="air_alert_ua/'.$id.'">'
            .'<div class="tgme_widget_message_text js-message_text" dir="auto">'.$text.'</div>'
            .'<time datetime="'.now()->subMinutes($minutesAgo)->toIso8601String().'" class="time">10:00</time></div></div>';
        $html = $post(101, '🔴 10:00 Повітряна тривога в Харківська область.<br/>Слідкуйте за подальшими повідомленнями.<br/>#Харківська_область', 30)
            .$post(102, '🔴 10:05 Повітряна тривога в Бучанський район.<br/>#Київська_область', 25)
            .$post(103, '🟡 10:06 Загроза артобстрілу в Нікопольська територіальна громада.<br/>#Дніпропетровська_область', 24)
            .$post(104, '🔴 10:07 Повітряна тривога в Шосткинський район.<br/>#Сумська_область', 23)
            .$post(105, '🟢 10:20 Відбій тривоги в Шосткинський район.<br/>#Сумська_область', 10);
        Http::fake(function ($request) use ($html) {
            return str_contains($request->url(), 't.me/s/air_alert_ua')
                ? Http::response(str_contains($request->url(), 'before=') ? '' : $html)
                : Http::response(['states' => ['Луганська область' => ['alertnow' => true, 'changed' => '2022-04-04 19:45:39'], 'Харківська область' => ['alertnow' => true]]]);
        });

        $this->artisan('alerts:sync')->assertOk();
        $state = $this->service()->state();
        $this->assertSame('Повітряна тривога (Telegram)', $state['source']);
        $regions = collect($state['regions'])->keyBy('slug');
        $units = collect($state['units'])->keyBy('code');
        $this->assertSame('air_raid', $regions['kharkiv']['type']);
        $this->assertSame('partial', $regions['kyiv-oblast']['type']);
        $this->assertSame('artillery', $units['UA12080050000062712']['kind']);
        // Відбій знімає тривогу.
        $this->assertFalse($regions['sumy']['active']);
        // Давня тривога, якої немає в останніх дописах, — з ubilling.
        $this->assertTrue($regions['luhansk']['active']);

        // Повторний запуск не застосовує ті самі дописи вдруге.
        $this->assertSame(0, app(AirAlertChannel::class)->sync());
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

        $this->assertSame('NEPTUN', $state['source']);
        $this->assertSame('Дані: Карта повітряних загроз NEPTUN', $state['attribution']['text']);
        $regions = collect($state['regions'])->keyBy('slug');
        $this->assertSame('partial', $regions['odesa']['type']);
        $this->assertSame('air_raid', $regions['crimea']['type']);
        $units = collect($state['units'])->keyBy('code');
        // Райони за ключем без назви (транслітерація) теж знаходимо.
        $this->assertTrue($units->has('UA32080000000084076'));
        $this->assertSame(11, $units->filter(fn ($u, $code) => str_starts_with($code, 'UA01') || str_starts_with($code, 'UA85'))->count());

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
        $this->assertNotSame('NEPTUN', $this->service()->state()['source']);
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

        // Перевірка в адмінці: картка налаштована без ключів, тост перелічує джерела.
        $this->actingAs($admin)->post('/admin/integrations/cinema/air_alerts/test')->assertRedirect();
        $toast = session('inertia.flash_data.toast') ?? session('inertia.flash.toast') ?? collect(session()->all())->flatten(5)->first(fn ($v) => is_string($v) && str_contains($v, 'NEPTUN'));
        $message = is_array($toast) ? $toast['message'] : (string) $toast;
        $this->assertStringContainsString('UkraineAlarm: ключ не задано', $message);
        $this->assertStringContainsString('✅ NEPTUN тривоги', $message);
        $this->assertStringContainsString('Зараз мапа бере тривоги з: NEPTUN', $message);
    }

    public function test_alert_types_priority_scale_and_threat_levels(): void
    {
        $this->assertSame(AlertType::AIR, AlertType::fromApi('air_raid'));
        $this->assertSame(AlertType::ARTILLERY, AlertType::fromApi('artillery_shelling'));
        $this->assertSame(AlertType::NUCLEAR, AlertType::fromApi('NUCLEAR'));
        $this->assertSame(AlertScale::HROMADA, AlertScale::fromApi('Community'));
        $this->assertSame('#E11D48', AlertType::AIR->colors(AlertScale::RAION)['hex']);

        Http::fake([
            'api.alerts.in.ua/*' => Http::response(['alerts' => [
                ['location_type' => 'oblast', 'location_title' => 'Сумська область', 'location_oblast' => 'Сумська область', 'alert_type' => 'air_raid'],
                ['location_type' => 'raion', 'location_title' => 'Шосткинський район', 'location_oblast' => 'Сумська область', 'alert_type' => 'chemical'],
                ['location_type' => 'raion', 'location_title' => 'Бучанський район', 'location_oblast' => 'Київська область', 'alert_type' => 'air_raid'],
            ]]),
            '*' => Http::response(['states' => []]),
        ]);
        app(SiteSettings::class)->putSecret('alerts_in_ua_token', 'test-token-1234567890');
        AirThreat::query()->create(['type' => 'ballistic', 'region_slug' => 'kharkiv', 'place_name' => 'Харків', 'title' => 'Балістика', 'lat' => 50, 'lng' => 36.2, 'detected_at' => now(), 'expires_at' => now()->addMinutes(5)]);
        AirThreat::query()->create(['type' => 'uav', 'region_slug' => 'sumy', 'place_name' => 'Суми', 'title' => 'Шахед', 'lat' => 50.9, 'lng' => 34.8, 'detected_at' => now(), 'expires_at' => now()->addMinutes(5)]);
        $state = $this->service()->state();
        $regions = collect($state['regions'])->keyBy('slug');

        // Хімічна (90) важливіша за повітряну (70) й БпЛА (40); решта — вторинні бейджі.
        $this->assertSame('CHEMICAL', $regions['sumy']['alert']);
        $this->assertSame(['CHEMICAL', 'AIR', 'UAV'], $regions['sumy']['alerts']);
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
}
