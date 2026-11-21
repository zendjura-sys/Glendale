<?php

namespace Tests\Feature;

use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Families\FamilyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Цілісність сімей: видалена сім’я не «тримає» учасників і тег, а кожен розділ кабінету
 * віддає застосунку оболонку (family/me/can) — інакше застосунок думає, що сім’ї немає.
 */
class FamilyIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private GtaServer $server;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
        Http::preventStrayRequests();
        $this->server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
    }

    private function family(User $owner, string $tag = 'SCL'): Family
    {
        $family = app(FamilyService::class)->create($owner, [
            'server_id' => $this->server->id, 'name' => 'Scaletta '.$tag, 'tag' => $tag,
            'rp_nickname' => 'Marco_Scaletta', 'static_id' => (string) random_int(10000, 99999),
        ]);
        app(FamilyService::class)->setStatus($family, User::factory()->admin()->create(), Family::STATUS_VERIFIED, null);

        return $family->refresh();
    }

    public function test_deleted_family_frees_its_members_and_tag(): void
    {
        $owner = User::factory()->create();
        $family = $this->family($owner);
        $mate = User::factory()->create();
        $family->members()->create(['user_id' => $mate->id, 'rp_nickname' => 'Tony_Moretti', 'static_id' => '20002', 'rank' => 1, 'status' => FamilyMember::STATUS_ACTIVE, 'joined_at' => now()]);

        $this->actingAs($owner)->delete(route('families.destroy', $family), ['confirm' => $family->slug])->assertRedirect();

        // Учасники видаленої сім’ї більше не «в сім’ї» — ніде не показується штаб, що не існує.
        $this->assertSame(0, FamilyMember::query()->where('family_id', $family->id)->where('status', FamilyMember::STATUS_ACTIVE)->count());
        $this->assertNotNull(FamilyMember::query()->where('family_id', $family->id)->where('user_id', $mate->id)->value('left_at'));

        // Той самий тег на тому самому сервері знову вільний — і для власника, і для учасника.
        $again = $this->family($owner, 'SCL');
        $this->assertSame('SCL', $again->tag);
        $this->actingAs($mate)->get(route('families.index'))->assertOk();
    }

    public function test_every_cabinet_section_gives_the_app_the_family_shell(): void
    {
        $owner = User::factory()->create();
        $family = $this->family($owner);
        $token = app(ApiTokens::class)->issue($owner, 'android');

        foreach (['', '/reports', '/queue', '/bank', '/warehouse', '/members', '/discipline', '/events', '/shifts', '/rating', '/audit', '/settings', '/charter', '/wiki', '/relations', '/history'] as $section) {
            $json = $this->withToken($token)->getJson("/api/v1/site/f/{$family->slug}{$section}")->assertOk()->json();
            $this->assertSame($family->slug, $json['family']['slug'] ?? null, "розділ «{$section}» без family");
            $this->assertArrayHasKey('me', $json, "розділ «{$section}» без me");
            $this->assertArrayHasKey('can', $json, "розділ «{$section}» без can");
        }
    }
}
