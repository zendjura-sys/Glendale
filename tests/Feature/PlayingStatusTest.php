<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Games\GameCatalog;
use App\Services\Presence\DiscordPresence;
use App\Support\Settings\SiteSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PlayingStatusTest extends TestCase
{
    use RefreshDatabase;

    private GtaServer $server;

    protected function setUp(): void
    {
        parent::setUp();
        app(GameCatalog::class)->seed();
        $this->server = GtaServer::query()->create([
            'slug' => 'majestic-rp', 'name' => 'Majestic RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
    }

    private function token(User $user): string
    {
        return (string) $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password', 'device' => 'Test'])->assertOk()->json('token');
    }

    public function test_manual_status_shows_on_profile_and_server_page(): void
    {
        $user = User::factory()->create();
        $viewer = User::factory()->create();

        $this->actingAs($user)->put(route('playing.update'), ['kind' => 'server', 'id' => $this->server->id, 'note' => 'Сім’я Scaletta', 'hours' => 3])->assertSessionHasNoErrors();

        $this->actingAs($viewer)->get(route('profile.show', $user))
            ->assertInertia(fn (Assert $page) => $page
                ->where('profile.playing.label', 'Majestic RP')
                ->where('profile.playing.note', 'Сім’я Scaletta')
                ->where('profile.playing.url', '/servers/majestic-rp')
                ->where('profile.playing.auto', false));

        $this->actingAs($viewer)->get(route('servers.show', $this->server))
            ->assertInertia(fn (Assert $page) => $page->where('playing_count', 1)->where('playing_now.0.id', $user->id));

        $this->actingAs($user)->delete(route('playing.destroy'))->assertSessionHasNoErrors();
        $this->assertNull($user->fresh()?->playing());
    }

    public function test_discord_rich_presence_sets_server_and_game_but_never_overrides_manual(): void
    {
        app(SiteSettings::class)->put(['discord_guild_id' => '111111111111111111']);
        $user = User::factory()->create(['discord_id' => '222222222222222222']);
        $presence = app(DiscordPresence::class);

        // GTA RP пише сервер у деталях активності.
        $this->assertTrue($presence->handle([
            'guild_id' => '111111111111111111', 'user' => ['id' => '222222222222222222'], 'status' => 'online',
            'activities' => [['type' => 4, 'name' => 'Custom Status'], ['type' => 0, 'name' => 'RAGE Multiplayer', 'details' => 'Majestic RP | Server 3']],
        ]));
        $this->assertSame('Majestic RP', $user->fresh()?->playing()['label'] ?? null);
        $this->assertTrue($user->fresh()?->playing()['auto'] ?? false);

        // Гра з каталогу за назвою.
        $presence->handle(['guild_id' => '111111111111111111', 'user' => ['id' => '222222222222222222'], 'activities' => [['type' => 0, 'name' => 'Counter-Strike 2']]]);
        $this->assertSame('/games/counter-strike-2', $user->fresh()?->playing()['url'] ?? null);

        // Вийшов із гри — статус прибирається.
        $presence->handle(['guild_id' => '111111111111111111', 'user' => ['id' => '222222222222222222'], 'activities' => []]);
        $this->assertNull($user->fresh()?->playing());

        // Ручний статус автоматика не чіпає; чужий Discord-сервер ігнорується.
        $this->actingAs($user)->put(route('playing.update'), ['kind' => 'server', 'id' => $this->server->id, 'hours' => 1]);
        $presence->handle(['guild_id' => '111111111111111111', 'user' => ['id' => '222222222222222222'], 'activities' => [['type' => 0, 'name' => 'Dota 2']]]);
        $this->assertSame('Majestic RP', $user->fresh()?->playing()['label'] ?? null);
        $this->assertFalse($presence->handle(['guild_id' => '999999999999999999', 'user' => ['id' => '222222222222222222'], 'activities' => []]));
    }

    public function test_steam_profile_link_and_sync(): void
    {
        app(SiteSettings::class)->putSecret('steam_api_key', str_repeat('A', 32));
        Http::preventStrayRequests();
        Http::fake([
            'api.steampowered.com/ISteamUser/ResolveVanityURL/*' => Http::response(['response' => ['success' => 1, 'steamid' => '76561198000000001']]),
            'api.steampowered.com/ISteamUser/GetPlayerSummaries/*' => Http::response(['response' => ['players' => [
                ['steamid' => '76561198000000001', 'gameid' => '730', 'gameextrainfo' => 'Counter-Strike 2'],
            ]]]),
        ]);
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('playing.steam'), ['profile' => 'https://steamcommunity.com/id/tonny/'])->assertSessionHasNoErrors();
        $this->assertSame('76561198000000001', $user->fresh()?->steam_id);

        $this->artisan('steam:presence')->assertSuccessful();
        $this->assertSame('/games/counter-strike-2', $user->fresh()?->playing()['url'] ?? null);

        // Вимкнув автоматичний статус — він зникає й більше не ставиться.
        $this->actingAs($user)->put(route('playing.auto'), ['auto' => false])->assertSessionHasNoErrors();
        $this->assertNull($user->fresh()?->playing());
        $this->artisan('steam:presence')->assertSuccessful();
        $this->assertNull($user->fresh()?->playing());
    }

    public function test_android_app_reports_mobile_game_by_play_package_or_name(): void
    {
        // Список серверів кешується на 10 хвилин — сервер має бути до першого звіту.
        GtaServer::query()->create(['slug' => 'black-russia', 'name' => 'Black Russia', 'platform' => 'mobile', 'multiplayer' => 'crmp', 'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed']);
        $user = User::factory()->create();
        $token = $this->token($user);
        $brawl = Game::query()->where('slug', 'brawl-stars')->sole();
        $package = null;
        foreach ($brawl->links ?? [] as $link) {
            if ($link['store'] === 'gplay' && preg_match('#[?&]id=([A-Za-z0-9_.]+)#', $link['url'], $m) === 1) {
                $package = $m[1];
            }
        }
        $this->assertNotNull($package);

        $this->withToken($token)->getJson('/api/v1/me/playing/packages')->assertOk()->assertJsonFragment([$package]);

        $this->withToken($token)->postJson('/api/v1/me/playing/mobile', ['package' => $package, 'label' => 'Brawl Stars'])
            ->assertOk()->assertJsonPath('playing.url', '/games/brawl-stars');

        // Мобільний проєкт GTA — як сервер (за назвою застосунку), навіть якщо він є й у каталозі ігор.
        $this->withToken($token)->postJson('/api/v1/me/playing/mobile', ['package' => 'com.br.top', 'label' => 'BLACK RUSSIA'])
            ->assertOk()->assertJsonPath('playing.url', '/servers/black-russia');

        $this->withToken($token)->postJson('/api/v1/me/playing/mobile', ['package' => null])->assertOk()->assertJsonPath('playing', null);
    }
}
