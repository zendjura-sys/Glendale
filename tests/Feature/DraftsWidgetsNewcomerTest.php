<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Віджети для сайтів і «Тиждень новачка» (чернетки — на клієнті). */
class DraftsWidgetsNewcomerTest extends TestCase
{
    use RefreshDatabase;

    public function test_player_and_server_widgets(): void
    {
        $user = User::factory()->create(['username' => 'neo', 'status' => 'Шукаю тиму в CS2']);
        $hidden = User::factory()->create(['username' => 'ghost', 'is_private' => true]);
        $server = GtaServer::query()->create(['slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp', 'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed']);
        $server->forceFill(['players_online' => 812, 'players_max' => 1000])->save();

        $this->getJson('/widget/u/neo')->assertOk()->assertHeader('Access-Control-Allow-Origin', '*')
            ->assertJsonPath('name', $user->name)->assertJsonPath('lines.0', 'Шукаю тиму в CS2')->assertJsonPath('href', url('/neo'));
        $this->get('/widget/u/neo/card.js')->assertOk()->assertHeader('Content-Type', 'application/javascript; charset=UTF-8');
        $this->getJson('/widget/u/ghost')->assertNotFound();
        $this->getJson('/widget/s/quant-rp')->assertOk()->assertJsonPath('lines.0', 'Онлайн: 812 / 1000');
        $server->update(['status' => GtaServer::STATUS_PENDING]);
        $this->getJson('/widget/s/quant-rp')->assertNotFound();
        $this->assertNotNull($hidden);
    }

    public function test_newcomer_week_tracks_steps_and_can_be_hidden(): void
    {
        $fresh = User::factory()->create(['created_at' => now()->subDays(2)]);
        $friend = User::factory()->create();
        app(FriendshipService::class)->request($fresh, $friend);
        app(FriendshipService::class)->accept($friend, $fresh);

        $this->actingAs($fresh)->get('/feed')->assertInertia(fn (Assert $page) => $page
            ->where('newcomer.day', 3)
            ->where('newcomer.total', 7)
            ->where('newcomer.steps', fn ($steps) => collect($steps)->firstWhere('key', 'friend')['done'] === true
                && collect($steps)->firstWhere('key', 'post')['done'] === false));

        $this->actingAs($fresh)->post('/posts', ['body' => 'Привіт усім!', 'visibility' => 'public'])->assertSessionHasNoErrors();
        $this->actingAs($fresh)->get('/feed')->assertInertia(fn (Assert $page) => $page
            ->where('newcomer.steps', fn ($steps) => collect($steps)->firstWhere('key', 'post')['done'] === true));

        $this->actingAs($fresh)->post('/newcomer/hide')->assertRedirect();
        $this->actingAs($fresh)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('newcomer', null));

        $old = User::factory()->create(['created_at' => now()->subDays(10)]);
        $this->actingAs($old)->get('/feed')->assertInertia(fn (Assert $page) => $page->where('newcomer', null));
    }
}
