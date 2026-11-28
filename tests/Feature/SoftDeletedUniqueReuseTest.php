<?php

namespace Tests\Feature;

use App\Models\Clan;
use App\Models\Community;
use App\Models\Family;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Clans\ClanService;
use App\Services\CommunityService;
use App\Services\Families\FamilyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Після м’якого видалення slug/tag звільняються — нову сутність з тим самим тегом можна створити. */
class SoftDeletedUniqueReuseTest extends TestCase
{
    use RefreshDatabase;

    public function test_family_tag_can_be_reused_after_soft_delete(): void
    {
        $server = GtaServer::query()->create([
            'slug' => 'quant',
            'name' => 'Quant',
            'platform' => 'pc',
            'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'seed',
        ]);
        $owner = User::factory()->create();
        $family = app(FamilyService::class)->create($owner, [
            'server_id' => $server->id,
            'name' => 'BlackRock',
            'tag' => 'BLACK',
            'rp_nickname' => 'Marco_Scaletta',
            'static_id' => '1',
        ]);
        $slug = $family->slug;

        $this->actingAs($owner)->delete("/f/{$slug}", ['confirm' => $slug])->assertRedirect(route('families.index'));

        $this->assertSoftDeleted('families', ['id' => $family->id]);
        $trashed = Family::withTrashed()->findOrFail($family->id);
        $this->assertNotSame('BLACK', $trashed->tag);
        $this->assertStringEndsWith('-d'.$family->id, $trashed->slug);

        $other = User::factory()->create();
        $again = app(FamilyService::class)->create($other, [
            'server_id' => $server->id,
            'name' => 'BlackRock',
            'tag' => 'BLACK',
            'rp_nickname' => 'Ann_Other',
            'static_id' => '2',
        ]);
        $this->assertSame('BLACK', $again->tag);
        $this->assertSame($slug, $again->slug);

        $this->actingAs($other)->post('/families', [
            'server_id' => $server->id,
            'name' => 'Dup',
            'tag' => 'BLACK',
            'rp_nickname' => 'Bob_Other',
            'static_id' => '3',
        ])->assertSessionHasErrors('tag');
    }

    public function test_community_slug_can_be_reused_after_soft_delete(): void
    {
        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'Night City',
            'type' => Community::TYPE_GROUP,
            'category' => array_key_first(Community::CATEGORIES),
            'privacy' => Community::PRIVACY_OPEN,
            'slug' => 'night-city',
        ]);

        $this->actingAs($owner)->delete('/c/night-city', ['confirm' => 'night-city'])->assertRedirect(route('communities.index'));
        $this->assertSoftDeleted('communities', ['id' => $community->id]);
        $this->assertStringEndsWith('-d'.$community->id, Community::withTrashed()->findOrFail($community->id)->slug);

        $again = app(CommunityService::class)->create(User::factory()->create(), [
            'name' => 'Night City',
            'type' => Community::TYPE_GROUP,
            'category' => array_key_first(Community::CATEGORIES),
            'privacy' => Community::PRIVACY_OPEN,
            'slug' => 'night-city',
        ]);
        $this->assertSame('night-city', $again->slug);
    }

    public function test_clan_slug_freed_on_soft_delete(): void
    {
        $owner = User::factory()->create();
        $game = Game::query()->create([
            'slug' => 'cs2',
            'name' => 'CS2',
            'letter' => 'C',
            'category' => 'pc',
            'is_published' => true,
        ]);
        $clan = app(ClanService::class)->create($owner, [
            'type' => 'clan',
            'name' => 'Alpha',
            'tag' => 'ALP',
            'game_id' => $game->id,
            'description' => null,
            'features' => [],
            'join_mode' => Clan::JOIN_REQUEST,
        ], null);
        $slug = $clan->slug;

        $this->actingAs($owner)->delete("/clans/{$slug}", ['confirm' => $slug])->assertRedirect(route('clans.index'));
        $this->assertSoftDeleted('clans', ['id' => $clan->id]);
        $this->assertStringEndsWith('-d'.$clan->id, Clan::withTrashed()->findOrFail($clan->id)->slug);
        $this->assertNotSame('ALP', Clan::withTrashed()->findOrFail($clan->id)->tag);
    }

    public function test_family_charter_bridge_returns_shell_props(): void
    {
        $server = GtaServer::query()->create([
            'slug' => 'quant',
            'name' => 'Quant',
            'platform' => 'pc',
            'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'seed',
        ]);
        $owner = User::factory()->create();
        $family = app(FamilyService::class)->create($owner, [
            'server_id' => $server->id,
            'name' => 'Shell',
            'tag' => 'SHL',
            'rp_nickname' => 'Marco_Scaletta',
            'static_id' => '1',
        ]);
        $token = app(ApiTokens::class)->issue($owner, 'android');

        foreach (['charter', 'wiki', 'relations', 'history'] as $section) {
            $this->withToken($token)
                ->getJson("/api/v1/site/f/{$family->slug}/{$section}")
                ->assertOk()
                ->assertJsonPath('family.tag', 'SHL')
                ->assertJsonStructure(['family', 'me', 'can', 'section']);
        }
    }
}
