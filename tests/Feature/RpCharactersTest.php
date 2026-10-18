<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\RpCharacter;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use App\Services\Families\FamilyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class RpCharactersTest extends TestCase
{
    use RefreshDatabase;

    private function server(string $slug): GtaServer
    {
        return GtaServer::query()->create([
            'slug' => $slug, 'name' => ucfirst($slug).' RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return [
            'server' => 'quant',
            'name' => 'Тарас Коваль',
            'age' => 34,
            'occupation' => 'Механік',
            'bio' => 'Тримає гараж біля порту.',
            'story' => 'Приїхав у місто після служби.',
            'status' => 'active',
            'is_main' => true,
            ...$overrides,
        ];
    }

    public function test_player_creates_characters_with_family_photos_and_one_main_per_server(): void
    {
        Storage::fake('public');
        $this->withoutVite();
        $server = $this->server('quant');
        $other = $this->server('other');
        $player = User::factory()->create();
        $family = app(FamilyService::class)->create($player, [
            'server_id' => $server->id, 'name' => 'Scaletta Family', 'tag' => 'SCL',
            'rp_nickname' => 'Taras_Koval', 'static_id' => '10001',
        ]);
        $foreign = app(FamilyService::class)->create(User::factory()->create(), [
            'server_id' => $other->id, 'name' => 'Other Family', 'tag' => 'OTH',
            'rp_nickname' => 'Other_Guy', 'static_id' => '10002',
        ]);

        // Чужа сім’я або сім’я з іншого сервера — ні.
        $this->actingAs($player)->post(route('characters.store'), $this->payload(['family_id' => $foreign->id]))->assertStatus(422);

        $this->actingAs($player)->post(route('characters.store'), $this->payload([
            'family_id' => $family->id,
            'portrait' => UploadedFile::fake()->image('me.jpg', 800, 1000),
        ]))->assertRedirect();
        $first = RpCharacter::query()->sole();
        $this->assertSame($family->id, $first->family_id);
        $this->assertNotNull($first->portrait_path);
        Storage::disk('public')->assertExists($first->portrait_path);

        // Другий головний на тому самому сервері знімає позначку з першого.
        $this->actingAs($player)->post(route('characters.store'), $this->payload(['name' => 'Ліна', 'status' => 'retired']))->assertRedirect();
        $this->assertFalse($first->fresh()->is_main);

        $this->actingAs($player)->post(route('characters.photos.store', $first), ['photo' => UploadedFile::fake()->image('car.jpg')])->assertRedirect();
        $this->assertCount(1, $first->fresh()->photos);

        $stranger = User::factory()->create();
        $this->actingAs($stranger)->post(route('characters.update', $first), $this->payload())->assertForbidden();
        $this->actingAs($stranger)->get(route('characters.show', $first))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('characters/show')
                ->where('character.name', 'Тарас Коваль')
                ->where('character.family.tag', 'SCL')
                ->has('character.photos', 1)
                ->has('others', 1)
                ->where('can_edit', false));

        $this->actingAs($stranger)->get(route('servers.show', $server))
            ->assertInertia(fn (Assert $page) => $page->has('characters', 2));
        $this->actingAs($stranger)->get('/'.$player->username)
            ->assertInertia(fn (Assert $page) => $page->has('characters', 2));

        $this->actingAs($player)->delete(route('characters.photos.destroy', [$first, 0]))->assertRedirect();
        $this->assertNull($first->fresh()->photos);
        $this->actingAs($player)->delete(route('characters.destroy', $first))->assertRedirect('/'.$player->username);
        Storage::disk('public')->assertMissing((string) $first->portrait_path);
        $this->assertSame(1, RpCharacter::query()->count());
    }

    public function test_app_creates_a_character_through_the_site_bridge(): void
    {
        $this->server('quant');
        $user = User::factory()->create();
        $token = app(ApiTokens::class)->issue($user, 'android');

        $this->withToken($token)->getJson('/api/v1/site/characters/create')
            ->assertOk()
            ->assertJsonPath('servers.0.slug', 'quant');
        $this->withToken($token)->postJson('/api/v1/site/characters', $this->payload())->assertSuccessful();
        $this->assertSame('Тарас Коваль', RpCharacter::query()->sole()->name);
    }
}
