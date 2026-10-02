<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\User;
use App\Services\Servers\ServerDirectory;
use App\Services\Servers\ServerIconFetcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ServersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Http::preventStrayRequests();
    }

    private function png(int $w = 128, int $h = 128): string
    {
        $img = imagecreatetruecolor($w, $h);
        for ($x = 0; $x < $w; $x += 8) {
            imagefilledrectangle($img, $x, 0, $x + 7, $h, (int) imagecolorallocate($img, ($x * 7) % 255, ($x * 3) % 255, 200));
        }
        ob_start();
        imagepng($img);

        return (string) ob_get_clean();
    }

    private function server(array $attributes = []): GtaServer
    {
        return GtaServer::query()->create([
            'slug' => 'quant-rp',
            'name' => 'Quant RP',
            'platform' => 'pc',
            'multiplayer' => 'ragemp',
            'connect' => 'quant-s1.com.ua:22005',
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'seed',
            ...$attributes,
        ]);
    }

    public function test_catalog_lists_published_servers_with_platform_filter(): void
    {
        $this->server();
        $this->server(['slug' => 'mriya-rp', 'name' => 'Мрія РП', 'platform' => 'mobile', 'multiplayer' => 'launcher', 'connect' => null]);
        $this->server(['slug' => 'hidden', 'name' => 'Hidden RP', 'status' => GtaServer::STATUS_PENDING, 'connect' => null]);

        $this->actingAs(User::factory()->create())
            ->get(route('servers.index', ['platform' => 'mobile']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('servers/index')
                ->has('servers', 1)
                ->where('servers.0.name', 'Мрія РП')
                ->where('stats.servers', 2)
                ->where('stats.mobile', 1));
    }

    public function test_player_can_suggest_missing_server_and_admin_publishes_it(): void
    {
        Http::fake([
            'discord.com/api/v10/invites/*' => Http::response(['guild' => ['id' => '123', 'name' => 'Nova', 'icon' => 'abc'], 'approximate_member_count' => 900, 'approximate_presence_count' => 120]),
            'cdn.discordapp.com/*' => Http::response($this->png(), 200, ['Content-Type' => 'image/png']),
        ]);
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('servers.suggest'), [
            'name' => 'Nova Ukraine RP',
            'platform' => 'pc',
            'multiplayer' => 'altv',
            'discord' => 'https://discord.gg/novaua',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $server = GtaServer::query()->where('name', 'Nova Ukraine RP')->firstOrFail();
        $this->assertSame(GtaServer::STATUS_PENDING, $server->status);
        $this->assertSame('suggested', $server->origin);
        $this->assertSame('novaua', $server->discord_invite);
        $this->assertSame($user->id, $server->suggested_by);
        $this->assertSame('discord', $server->icon_source);
        Storage::disk('public')->assertExists((string) $server->icon_path);

        // Повтор тієї ж назви не створює дубль.
        $this->actingAs($user)->post(route('servers.suggest'), ['name' => 'nova ukraine rp', 'platform' => 'pc', 'multiplayer' => 'altv']);
        $this->assertSame(1, GtaServer::query()->where('name', 'like', 'Nova%')->count());

        $this->actingAs($user)->get(route('servers.index'))
            ->assertInertia(fn (Assert $page) => $page->has('servers', 0)->has('my_suggestions', 1));

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->patch(route('admin.servers.moderate', $server), ['status' => 'published'])->assertRedirect();
        $this->assertSame(GtaServer::STATUS_PUBLISHED, $server->fresh()->status);
        $this->assertSame(900, $server->fresh()->discord_members);
    }

    public function test_suggestion_validates_links(): void
    {
        $this->actingAs(User::factory()->create())
            ->post(route('servers.suggest'), ['name' => 'X', 'platform' => 'console', 'multiplayer' => 'ragemp', 'discord' => 'не посилання', 'website' => 'ftp://x'])
            ->assertSessionHasErrors(['name', 'platform', 'discord', 'website']);
    }

    public function test_admin_adds_server_manually_and_icon_is_taken_from_website(): void
    {
        Http::fake([
            'https://olymp-rp.com' => Http::response('<html><head><link rel="icon" href="/fav-16.png" sizes="16x16"><link rel="apple-touch-icon" href="/apple.png"></head></html>'),
            'https://olymp-rp.com/apple.png' => Http::response($this->png(180, 180), 200, ['Content-Type' => 'image/png']),
            '*' => Http::response('', 404),
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin)->post(route('admin.servers.store'), [
            'name' => 'Olymp RP',
            'platform' => 'pc',
            'multiplayer' => 'own',
            'website' => 'https://olymp-rp.com',
            'tagline' => 'Власний мультиплеєр',
            'is_featured' => true,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $server = GtaServer::query()->where('slug', 'olymp-rp')->firstOrFail();
        $this->assertSame(GtaServer::STATUS_PUBLISHED, $server->status);
        $this->assertSame('manual', $server->origin);
        $this->assertTrue($server->is_featured);
        $this->assertSame('website', $server->icon_source);
        Http::assertSent(fn ($request) => $request->url() === 'https://olymp-rp.com/apple.png');
    }

    public function test_icon_falls_back_to_google_favicon_and_admin_can_upload_own(): void
    {
        Http::fake([
            'https://ua-online.games' => Http::response('<html></html>'),
            'https://ua-online.games/favicon.ico' => Http::response('', 404),
            'www.google.com/s2/favicons*' => Http::response($this->png(64, 64), 200, ['Content-Type' => 'image/png']),
        ]);
        $server = $this->server(['slug' => 'ua-online', 'name' => 'UA Online', 'website' => 'https://ua-online.games', 'connect' => null]);

        $this->assertSame('google', app(ServerIconFetcher::class)->fetch($server));

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->post(route('admin.servers.update', $server), [
            'name' => 'UA Online',
            'platform' => 'mobile',
            'multiplayer' => 'launcher',
            'website' => 'https://ua-online.games',
            'icon' => UploadedFile::fake()->image('icon.png', 300, 300),
        ])->assertSessionHasNoErrors();

        $this->assertSame('upload', $server->fresh()->icon_source);
        $this->assertSame('mobile', $server->fresh()->platform);
    }

    public function test_directory_refreshes_online_and_discovers_new_ukrainian_servers(): void
    {
        Http::fake([
            ServerDirectory::RAGE_MASTER => Http::response([
                'quant-s1.com.ua:22005' => ['name' => 'Quant RP | Ми разом! [UKRAINE]', 'lang' => 'ua', 'players' => 1350, 'maxplayers' => 3000, 'peak' => 1600, 'url' => 'https://qnt5.fun'],
                'play.kyiv-rp.com:22005' => ['name' => '🔥 Kyiv RP | Новий сервер | discord.gg/kyivrp [UA] [VOICE]', 'lang' => 'ua', 'players' => 42, 'maxplayers' => 500, 'url' => 'kyiv-rp.com'],
                'de.server:22005' => ['name' => 'German RP', 'lang' => 'de', 'players' => 10, 'maxplayers' => 100],
            ]),
        ]);
        $quant = $this->server();

        $directory = app(ServerDirectory::class);
        $this->assertSame(1, $directory->refreshStats()['updated']);
        $this->assertSame(1350, $quant->fresh()->players_online);
        $this->assertSame(3000, $quant->fresh()->players_max);

        $found = $directory->discover();
        $this->assertCount(1, $found);
        $this->assertSame('Kyiv RP', $found[0]->name);
        $this->assertSame('Новий сервер', $found[0]->tagline);
        $this->assertSame('kyivrp', $found[0]->discord_invite);
        $this->assertSame('https://kyiv-rp.com', $found[0]->website);
        $this->assertSame(GtaServer::STATUS_PENDING, $found[0]->status);
        $this->assertSame(42, $found[0]->players_online);

        $this->assertCount(0, $directory->discover());
    }

    public function test_only_admins_manage_servers(): void
    {
        $server = $this->server();
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('admin.servers.index'))->assertForbidden();
        $this->actingAs($user)->post(route('admin.servers.store'), ['name' => 'X RP', 'platform' => 'pc', 'multiplayer' => 'ragemp'])->assertForbidden();
        $this->actingAs($user)->delete(route('admin.servers.destroy', $server))->assertForbidden();

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin)->get(route('admin.servers.index', ['status' => 'published']))
            ->assertInertia(fn (Assert $page) => $page->component('admin/servers')->has('servers', 1));
        $this->actingAs($admin)->delete(route('admin.servers.destroy', $server))->assertRedirect();
        $this->assertSoftDeleted($server);
        $this->actingAs($admin)->post(route('admin.servers.restore', $server->id))->assertRedirect();
        $this->assertNotSoftDeleted($server);
    }

    public function test_server_page_shows_verified_families(): void
    {
        $server = $this->server();
        $this->actingAs(User::factory()->create())
            ->get(route('servers.show', $server))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('servers/show')->where('server.name', 'Quant RP')->has('families', 0));
    }
}
