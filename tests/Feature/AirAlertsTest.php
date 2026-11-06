<?php

namespace Tests\Feature;

use App\Models\AirThreat;
use App\Models\User;
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
}
