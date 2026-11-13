<?php

namespace Tests\Feature;

use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Families\FamilyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Членство у видаленій сім’ї не ламає сторінку сервера (раніше — 500 «server_id on null»). */
class ServerPageDeletedFamilyTest extends TestCase
{
    use RefreshDatabase;

    public function test_server_page_opens_for_member_of_deleted_family(): void
    {
        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $leader = User::factory()->create();
        $family = app(FamilyService::class)->create($leader, [
            'server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta', 'static_id' => '10001',
        ]);
        $this->assertTrue(FamilyMember::query()->where('user_id', $leader->id)->where('status', FamilyMember::STATUS_ACTIVE)->exists());
        $family->delete();

        $this->actingAs($leader)->get('/servers/quant-rp')->assertOk();
        $this->actingAs($leader)->get('/characters/create')->assertSuccessful();
    }
}
