<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\ServerClaim;
use App\Models\ServerNews;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ServerFavoritesClaimTest extends TestCase
{
    use RefreshDatabase;

    private function server(string $slug, string $name): GtaServer
    {
        return GtaServer::query()->create([
            'slug' => $slug,
            'name' => $name,
            'platform' => 'pc',
            'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'seed',
        ]);
    }

    public function test_saved_servers_appear_as_favorites(): void
    {
        $this->withoutVite();
        $user = User::factory()->create();
        $kept = $this->server('kept', 'Kept RP');
        $this->server('other', 'Other RP');

        $this->actingAs($user)->postJson(route('saved.toggle'), ['kind' => 'server', 'id' => $kept->id])
            ->assertOk()
            ->assertJsonPath('saved', true);

        $this->actingAs($user)->get(route('servers.index', ['saved' => 1]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('servers/index')
                ->where('filters.saved', true)
                ->has('servers', 1)
                ->where('servers.0.slug', 'kept')
                ->has('favorites', 1)
                ->where('favorites.0.slug', 'kept'));
    }

    public function test_staff_confirms_an_owner_who_can_post_news(): void
    {
        $this->withoutVite();
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $staff = User::factory()->create(['role' => User::ROLE_MODERATOR]);
        $server = $this->server('quant', 'Quant RP');

        $this->actingAs($owner)->post(route('servers.news.store', $server), ['body' => 'Рано'])->assertForbidden();
        $this->actingAs($owner)->post(route('servers.claim', $server), ['message' => 'Я адмін проєкту'])->assertRedirect();
        $claim = ServerClaim::query()->sole();
        $this->assertSame(ServerClaim::PENDING, $claim->status);

        $this->actingAs($other)->post(route('servers.claims.decide', [$server, $claim]), ['status' => 'approved'])->assertForbidden();
        $this->actingAs($staff)->post(route('servers.claims.decide', [$server, $claim]), ['status' => 'approved'])->assertRedirect();
        $this->assertSame($owner->id, $server->fresh()->owner_id);

        $this->actingAs($other)->post(route('servers.news.store', $server), ['body' => 'Чуже'])->assertForbidden();
        $this->actingAs($owner)->post(route('servers.news.store', $server), ['body' => 'Вайп у п’ятницю'])->assertRedirect();
        $this->assertSame('Вайп у п’ятницю', ServerNews::query()->sole()->body);

        $this->actingAs($owner)->get(route('servers.show', $server))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('ownership.is_owner', true)
                ->where('ownership.news.0.body', 'Вайп у п’ятницю')
                ->where('ownership.owner.username', $owner->username));
    }
}
