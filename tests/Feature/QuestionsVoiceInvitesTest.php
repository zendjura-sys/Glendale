<?php

namespace Tests\Feature;

use App\Models\Clan;
use App\Models\ClanMember;
use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Family;
use App\Models\FamilyMember;
use App\Models\Game;
use App\Models\GtaServer;
use App\Models\User;
use App\Services\CommunityService;
use App\Services\Families\FamilyService;
use App\Services\Games\GameCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class QuestionsVoiceInvitesTest extends TestCase
{
    use RefreshDatabase;

    public function test_clan_application_requires_the_leaders_questions(): void
    {
        app(GameCatalog::class)->seed();
        $game = Game::query()->where('slug', 'counter-strike-2')->sole();
        $leader = User::factory()->create();
        $this->actingAs($leader)->post(route('clans.store'), [
            'type' => 'clan',
            'name' => 'Natus Vincere',
            'tag' => 'navi',
            'game_id' => $game->id,
            'features' => ['news'],
            'join_mode' => 'request',
        ])->assertRedirect();
        $clan = Clan::query()->sole();

        $this->actingAs($leader)->post(route('clans.update', $clan), [
            'questions' => ['Скільки годин граєте?', '', 'Яка роль?'],
        ])->assertRedirect();
        $this->assertSame(['Скільки годин граєте?', 'Яка роль?'], $clan->fresh()->questions);

        $applicant = User::factory()->create();
        $this->actingAs($applicant)->post(route('clans.join', $clan))->assertSessionHasErrors('answers');
        $this->actingAs($applicant)->post(route('clans.join', $clan), [
            'answers' => ['20 годин', 'Саппорт'],
        ])->assertRedirect();

        $member = ClanMember::query()->where('user_id', $applicant->id)->sole();
        $this->assertSame(ClanMember::STATUS_PENDING, $member->status);
        $this->assertSame(['20 годин', 'Саппорт'], $member->answers);
    }

    public function test_invite_links_open_a_closed_clan_family_and_community(): void
    {
        app(GameCatalog::class)->seed();
        $game = Game::query()->where('slug', 'counter-strike-2')->sole();
        $leader = User::factory()->create();
        $this->actingAs($leader)->post(route('clans.store'), [
            'type' => 'clan',
            'name' => 'Natus Vincere',
            'tag' => 'navi',
            'game_id' => $game->id,
            'features' => ['news'],
            'join_mode' => Clan::JOIN_CLOSED,
        ])->assertRedirect();
        $clan = Clan::query()->sole();
        $applicant = User::factory()->create();
        $this->actingAs($applicant)->post(route('clans.join', $clan))->assertSessionHasErrors('clan');
        $this->actingAs($applicant)->postJson(route('clans.invite-link', $clan))->assertForbidden();

        $url = $this->actingAs($leader)->postJson(route('clans.invite-link', $clan))->assertOk()->json('url');
        $token = basename((string) $url);
        $this->withoutVite()->actingAs($applicant)->get(route('invites.show', $token))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('join/show')
                ->where('invite.kind', 'clan')
                ->where('invite.needs_identity', false));
        $this->actingAs($applicant)->post(route('invites.accept', $token))->assertRedirect('/clans/'.$clan->slug);
        $this->assertSame(ClanMember::STATUS_ACTIVE, ClanMember::query()->where('user_id', $applicant->id)->value('status'));

        $owner = User::factory()->create();
        $community = app(CommunityService::class)->create($owner, [
            'name' => 'Закрита кімната',
            'type' => Community::TYPE_GROUP,
            'privacy' => Community::PRIVACY_CLOSED,
            'wall' => Community::WALL_CLOSED,
            'category' => 'games',
        ]);
        $guest = User::factory()->create();
        $this->assertSame(CommunityMember::STATUS_PENDING, app(CommunityService::class)->join($community, $guest));
        $link = basename((string) $this->actingAs($owner)->postJson(route('communities.invite-link', $community))->assertOk()->json('url'));
        $this->actingAs($guest)->post(route('invites.accept', $link))->assertRedirect('/c/'.$community->slug);
        $this->assertSame(CommunityMember::STATUS_ACTIVE, $community->membershipFor($guest)->status);

        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $family = app(FamilyService::class)->create($leader, [
            'server_id' => $server->id,
            'name' => 'Scaletta Family',
            'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta',
            'static_id' => '10001',
        ]);
        app(FamilyService::class)->setStatus($family, User::factory()->admin()->create(), Family::STATUS_VERIFIED, null);
        $family->update(['is_recruiting' => false]);
        $player = User::factory()->create();
        $familyLink = basename((string) $this->actingAs($leader)->postJson(route('families.invite-link', $family))->assertOk()->json('url'));
        $this->withoutVite()->actingAs($player)->get(route('invites.show', $familyLink))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('invite.needs_identity', true));
        $this->actingAs($player)->post(route('invites.accept', $familyLink), [
            'rp_nickname' => 'tony',
            'static_id' => 'abc',
        ])->assertSessionHasErrors(['rp_nickname', 'static_id']);
        $this->actingAs($player)->post(route('invites.accept', $familyLink), [
            'rp_nickname' => 'Tony_Moretti',
            'static_id' => '20002',
        ])->assertRedirect('/f/'.$family->slug);
        $this->assertSame(
            FamilyMember::STATUS_ACTIVE,
            FamilyMember::query()->where('family_id', $family->id)->where('user_id', $player->id)->value('status'),
        );
    }

    public function test_published_server_voice_is_open_and_only_a_verified_leader_manages_it(): void
    {
        $server = GtaServer::query()->create([
            'slug' => 'quant-rp', 'name' => 'Quant RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED, 'origin' => 'seed',
        ]);
        $player = User::factory()->create();
        $this->actingAs($player)->getJson(route('voice.index', ['server', $server->id]))
            ->assertOk()
            ->assertJsonPath('rooms.0.name', 'Загальна')
            ->assertJsonPath('can_manage', false);
        $this->actingAs($player)->postJson(route('voice.store', ['server', $server->id]), ['name' => 'Лобі'])->assertForbidden();

        $leader = User::factory()->create();
        $family = app(FamilyService::class)->create($leader, [
            'server_id' => $server->id,
            'name' => 'Scaletta Family',
            'tag' => 'SCL',
            'rp_nickname' => 'Marco_Scaletta',
            'static_id' => '10001',
        ]);
        $this->actingAs($leader)->postJson(route('voice.store', ['server', $server->id]), ['name' => 'Лобі'])->assertForbidden();
        app(FamilyService::class)->setStatus($family, User::factory()->admin()->create(), Family::STATUS_VERIFIED, null);
        $this->actingAs($leader)->postJson(route('voice.store', ['server', $server->id]), ['name' => 'Лобі'])
            ->assertCreated()
            ->assertJsonPath('can_manage', true);

        $hidden = GtaServer::query()->create([
            'slug' => 'hidden-rp', 'name' => 'Hidden RP', 'platform' => 'pc', 'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PENDING, 'origin' => 'seed',
        ]);
        $this->actingAs($player)->getJson(route('voice.index', ['server', $hidden->id]))->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->getJson(route('voice.index', ['server', $hidden->id]))
            ->assertOk()
            ->assertJsonPath('can_manage', true);
    }
}
