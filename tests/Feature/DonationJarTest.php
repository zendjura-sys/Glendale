<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Family;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Donations\MonobankJar;
use App\Services\Families\FamilyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Банка Monobank для сімей і спільнот: налаштування, картка «Підтримати», лише сайт. */
class DonationJarTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        config([
            'services.monobank_jar.send_url' => 'https://send.mono.test',
            'services.monobank_jar.api_url' => 'https://api.mono.test',
        ]);
        Http::fake([
            'send.mono.test/api/handler' => Http::response(['name' => 'На сервер', 'jarAmount' => 125050, 'jarGoal' => 500000, 'longJarId' => 'LONG123']),
            'api.mono.test/bank/jar/LONG123' => Http::response(['title' => 'На сервер', 'amount' => 130000, 'goal' => 500000, 'currency' => 980]),
        ]);
    }

    public function test_link_parsing(): void
    {
        $this->assertSame('3qWxYz12AB', MonobankJar::clientId('https://send.monobank.ua/jar/3qWxYz12AB'));
        $this->assertSame('3qWxYz12AB', MonobankJar::clientId('send.monobank.ua/jar/3qWxYz12AB/?ref=x'));
        $this->assertNull(MonobankJar::clientId('https://evil.test/send.monobank.ua/jar/3qWxYz12AB'));
        $this->assertNull(MonobankJar::clientId('https://send.monobank.ua/3qWxYz12AB'));
        $this->assertNull(MonobankJar::clientId(null));
    }

    public function test_family_leader_sets_jar_and_page_shows_progress(): void
    {
        $leader = User::factory()->create();
        $guest = User::factory()->create();
        $server = GtaServer::query()->create(['slug' => 'quant', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp', 'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed']);
        $family = app(FamilyService::class)->create($leader, ['server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL', 'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001']);
        $family->forceFill(['status' => Family::STATUS_VERIFIED])->save();

        $this->actingAs($guest)->put("/f/{$family->slug}/settings/jar", ['url' => 'https://send.monobank.ua/jar/3qWxYz12AB'])->assertForbidden();
        $this->actingAs($leader)->put("/f/{$family->slug}/settings/jar", ['url' => 'https://example.com/pay'])->assertStatus(422);
        $this->actingAs($leader)->put("/f/{$family->slug}/settings/jar", ['url' => 'send.monobank.ua/jar/3qWxYz12AB', 'note' => 'На оплату сервера'])->assertRedirect();
        $this->assertSame('https://send.monobank.ua/jar/3qWxYz12AB', $family->fresh()->donation_jar);

        // Гість бачить картку на публічній сторінці.
        $this->actingAs($guest)->get("/f/{$family->slug}")->assertInertia(fn (Assert $page) => $page
            ->component('families/public')
            ->loadDeferredProps(fn (Assert $reload) => $reload
                ->where('donation.url', 'https://send.monobank.ua/jar/3qWxYz12AB')
                ->where('donation.note', 'На оплату сервера')
                ->where('donation.title', 'На сервер')
                ->where('donation.amount', 125050)
                ->where('donation.goal', 500000)));
        Http::assertSent(fn (HttpRequest $r) => $r['clientId'] === '3qWxYz12AB' && $r['c'] === 'hello');

        // Прибрати банку — порожнє посилання.
        $this->actingAs($leader)->put("/f/{$family->slug}/settings/jar", ['url' => ''])->assertRedirect();
        $this->assertNull($family->fresh()->donation_jar);
    }

    public function test_community_jar_is_site_only(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($owner)->post(route('communities.store'), ['name' => 'Ретро ігри', 'type' => Community::TYPE_PUBLIC, 'category' => 'games', 'privacy' => Community::PRIVACY_OPEN]);
        $community = Community::query()->sole();

        $this->actingAs($other)->put("/c/{$community->slug}/settings/jar", ['url' => 'https://send.monobank.ua/jar/3qWxYz12AB'])->assertForbidden();
        $this->actingAs($owner)->put("/c/{$community->slug}/settings/jar", ['url' => 'https://send.monobank.ua/jar/3qWxYz12AB'])->assertRedirect();

        $this->actingAs($other)->get("/c/{$community->slug}")->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps(fn (Assert $reload) => $reload->where('donation.amount', 125050)));

        // Monobank не відповів — лишається кнопка без прогресу.
        config(['services.monobank_jar.send_url' => 'https://down.mono.test', 'services.monobank_jar.api_url' => 'https://down.mono.test']);
        Http::fake(['down.mono.test/*' => Http::response('', 500)]);
        $card = app(MonobankJar::class)->card('https://send.monobank.ua/jar/OtherJar99', null);
        $this->assertSame('https://send.monobank.ua/jar/OtherJar99', $card['url']);
        $this->assertNull($card['amount']);

        // У застосунок посилання на банку не потрапляє.
        $this->assertArrayNotHasKey('donation_jar', $community->fresh()->toArray());
        $token = app(ApiTokens::class)->issue($other, 'android');
        $json = $this->withToken($token)->getJson('/api/v1/communities/'.$community->slug)->getContent();
        $this->assertStringNotContainsString('monobank', (string) $json);
    }
}
