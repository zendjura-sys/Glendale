<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ServerAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_sees_views_and_clicks_for_30_days(): void
    {
        $this->withoutVite();
        [$owner, $visitor, $other] = User::factory()->count(3)->create();
        $server = GtaServer::query()->create([
            'slug' => 'quant', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $server->forceFill(['owner_id' => $owner->id])->save();

        // Перегляд від людини — раз на годину; власник не рахується.
        $this->actingAs($visitor)->get(route('servers.show', $server))->assertOk();
        $this->actingAs($visitor)->get(route('servers.show', $server))->assertOk();
        $this->actingAs($other)->get(route('servers.show', $server))->assertInertia(fn (Assert $page) => $page->where('analytics', null));
        $this->actingAs($owner)->get(route('servers.show', $server))->assertOk();
        $this->assertSame(2, (int) DB::table('server_stats')->value('views'));

        $this->actingAs($visitor)->postJson(route('servers.click', $server), ['kind' => 'connect'])->assertOk();
        $this->actingAs($visitor)->postJson(route('servers.click', $server), ['kind' => 'connect'])->assertOk();
        $this->actingAs($other)->postJson(route('servers.click', $server), ['kind' => 'discord'])->assertOk();
        $this->actingAs($other)->postJson(route('servers.click', $server), ['kind' => 'evil'])->assertStatus(422);

        $this->actingAs($owner)->get(route('servers.show', $server))
            ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
                ->has('analytics.days', 30)
                ->where('analytics.totals.views', 2)
                ->where('analytics.totals.connect', 1)
                ->where('analytics.totals.discord', 1)
                ->where('analytics.days.29.clicks', 2)));
    }
}
