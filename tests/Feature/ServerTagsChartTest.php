<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\User;
use App\Services\Servers\ServerDirectory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ServerTagsChartTest extends TestCase
{
    use RefreshDatabase;

    private function server(array $attributes = []): GtaServer
    {
        return GtaServer::query()->create([
            'slug' => 'quant',
            'name' => 'Quant RP',
            'platform' => 'pc',
            'multiplayer' => 'ragemp',
            'connect' => 'quant.example:22005',
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'seed',
            ...$attributes,
        ]);
    }

    public function test_a_stats_refresh_stores_the_daily_online_sample(): void
    {
        $this->withoutVite();
        Cache::flush();
        Http::fake([
            'https://cdn.rage.mp/master/' => Http::response([
                'quant.example:22005' => ['players' => 33, 'maxplayers' => 100, 'peak' => 80],
            ]),
        ]);
        $server = $this->server();
        $user = User::factory()->create();

        app(ServerDirectory::class)->refreshStats($server);

        $this->assertSame(33, (int) DB::table('server_online_samples')->where('gta_server_id', $server->id)->value('players_online'));
        $this->actingAs($user)->get(route('servers.show', $server))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('online.0.players', 33)
                ->has('similar', 0));
    }

    public function test_owner_sets_tags_and_similar_servers_share_a_client(): void
    {
        $this->withoutVite();
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $source = $this->server();
        $source->forceFill(['owner_id' => $owner->id])->save();
        $twin = $this->server([
            'slug' => 'twin',
            'name' => 'Twin RP',
            'connect' => 'twin.example:22005',
            'language' => 'de',
        ]);
        $this->server([
            'slug' => 'far',
            'name' => 'Far RP',
            'connect' => 'far.example:30120',
            'multiplayer' => 'fivem',
            'language' => 'de',
        ]);

        $this->actingAs($stranger)->post(route('servers.tags', $source), ['mode' => 'pvp', 'region' => 'Європа'])->assertForbidden();
        $this->actingAs($owner)->post(route('servers.tags', $source), ['mode' => 'rp', 'region' => 'Україна'])->assertRedirect();
        $this->assertSame('rp', $source->fresh()->tags['mode']);

        $this->actingAs($stranger)->get(route('servers.index', ['tag' => 'rp']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.tag', 'rp')
                ->has('servers', 1)
                ->where('servers.0.slug', 'quant'));

        $this->actingAs($stranger)->get(route('servers.show', $source))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('server.tags.mode', 'rp')
                ->where('server.tags.region', 'Україна')
                ->has('similar', 1)
                ->where('similar.0.slug', 'twin'));
    }
}
