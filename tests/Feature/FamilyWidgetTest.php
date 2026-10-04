<?php

namespace Tests\Feature;

use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Families\FamilyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FamilyWidgetTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return (string) $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password', 'device' => 'Test'])
            ->assertOk()->json('token');
    }

    public function test_widget_shows_own_money_rank_and_rating_per_family(): void
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
        $user = User::factory()->create();
        $family->members()->create([
            'user_id' => $user->id, 'rp_nickname' => 'Tony_Moretti', 'static_id' => '20002',
            'rank' => 3, 'status' => FamilyMember::STATUS_ACTIVE, 'joined_at' => now(),
        ])->forceFill(['balance' => 150_000])->save();

        $this->withToken($this->token($user))->getJson('/api/v1/me/family-widget')
            ->assertOk()
            ->assertJsonPath('families.0.family.tag', 'SCL')
            ->assertJsonPath('families.0.member.display', 'Tony_Moretti [20002]')
            ->assertJsonPath('families.0.balance', 150_000)
            ->assertJsonPath('families.0.treasury', null)
            ->assertJsonPath('families.0.rating.of', 2);

        // Лідер бачить і казну.
        $this->withToken($this->token($leader))->getJson('/api/v1/me/family-widget')
            ->assertJsonPath('families.0.treasury', 0);

        $this->withToken($this->token(User::factory()->create()))->getJson('/api/v1/me/family-widget')->assertJsonCount(0, 'families');
    }
}
