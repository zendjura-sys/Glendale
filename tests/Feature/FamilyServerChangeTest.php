<?php

namespace Tests\Feature;

use App\Models\Family;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Families\FamilyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Засновник переносить сім’ю на інший сервер (сайт і міст застосунку); раз на тиждень, тег вільний. */
class FamilyServerChangeTest extends TestCase
{
    use RefreshDatabase;

    private function server(string $slug): GtaServer
    {
        return GtaServer::query()->create(['slug' => $slug, 'name' => ucfirst($slug), 'platform' => 'pc', 'multiplayer' => 'ragemp', 'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed']);
    }

    public function test_owner_moves_family_to_another_server_once_a_week(): void
    {
        $a = $this->server('quant');
        $b = $this->server('majestic');
        $c = $this->server('radmir');
        $owner = User::factory()->create();
        $family = app(FamilyService::class)->create($owner, ['server_id' => $a->id, 'name' => 'Scaletta', 'tag' => 'SCL', 'rp_nickname' => 'Marco_Scaletta', 'static_id' => '1']);

        // На сервері B уже є сім’я з тим самим тегом.
        $other = User::factory()->create();
        app(FamilyService::class)->create($other, ['server_id' => $b->id, 'name' => 'Other', 'tag' => 'SCL', 'rp_nickname' => 'Ann_Other', 'static_id' => '2']);
        $this->actingAs($owner)->put("/f/{$family->slug}/settings/server", ['server_id' => $b->id])->assertSessionHasErrors('server_id');

        $this->actingAs($owner)->put("/f/{$family->slug}/settings/server", ['server_id' => $c->id])->assertSessionHasNoErrors();
        $this->assertSame($c->id, $family->fresh()->server_id);

        // Удруге за тиждень — ні; через міст застосунку — та сама перевірка.
        $token = app(ApiTokens::class)->issue($owner, 'android');
        $this->withToken($token)->putJson("/api/v1/site/f/{$family->slug}/settings/server", ['server_id' => $a->id])->assertStatus(422);
        $this->assertSame($c->id, Family::query()->find($family->id)->server_id);
    }
}
