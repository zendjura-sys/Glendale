<?php

namespace Tests\Feature;

use App\Models\Clan;
use App\Models\ClanContribution;
use App\Models\ClanMember;
use App\Models\ConversationParticipant;
use App\Models\Game;
use App\Models\User;
use App\Services\Games\GameCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ClansTest extends TestCase
{
    use RefreshDatabase;

    private User $leader;

    private Game $game;

    protected function setUp(): void
    {
        parent::setUp();
        app(GameCatalog::class)->seed();
        $this->game = Game::query()->where('slug', 'counter-strike-2')->sole();
        $this->leader = User::factory()->create();
    }

    /**
     * @param  list<string>  $features
     */
    private function clan(string $type = 'clan', array $features = ['news', 'events', 'treasury', 'voice', 'chat', 'rating'], string $join = 'request'): Clan
    {
        $this->actingAs($this->leader)->post(route('clans.store'), [
            'type' => $type,
            'name' => 'Natus Vincere',
            'tag' => 'navi',
            'game_id' => $this->game->id,
            'features' => $features,
            'join_mode' => $join,
        ])->assertRedirect();

        return Clan::query()->latest('id')->firstOrFail();
    }

    private function member(Clan $clan, int $rank = 1): User
    {
        $user = User::factory()->create();
        ClanMember::query()->create(['clan_id' => $clan->id, 'user_id' => $user->id, 'rank' => $rank, 'status' => ClanMember::STATUS_ACTIVE, 'joined_at' => now()]);

        return $user;
    }

    public function test_creating_clan_with_type_prefix_game_and_chosen_features(): void
    {
        $clan = $this->clan('guild', ['news', 'voice']);

        $this->assertSame('[Гільдія] Natus Vincere', $clan->display_name);
        $this->assertSame('NAVI', $clan->tag);
        $this->assertSame(['news', 'voice'], $clan->features);
        $this->assertSame(1, $clan->members_count);
        $this->assertNull($clan->conversation_id);

        $this->actingAs($this->leader)->get(route('clans.show', $clan))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('clans/show')
                ->where('clan.display_name', '[Гільдія] Natus Vincere')
                ->where('clan.game.slug', 'counter-strike-2')
                ->where('me.is_owner', true)
                ->where('me.can', fn ($can) => ($can['settings.manage'] ?? false) === true));

        $this->actingAs($this->leader)->getJson(route('games.show', $this->game))->assertJsonPath('clans.0.tag', 'NAVI');
    }

    public function test_application_is_accepted_by_officer_and_member_joins_chat(): void
    {
        $clan = $this->clan();
        $officer = $this->member($clan, 4);
        $applicant = User::factory()->create();

        $this->actingAs($applicant)->post(route('clans.join', $clan), ['note' => 'Граю 3 роки'])->assertSessionHasNoErrors();
        $application = ClanMember::query()->where('user_id', $applicant->id)->sole();
        $this->assertSame(ClanMember::STATUS_PENDING, $application->status);

        $this->actingAs($applicant)->post(route('clans.members.update', [$clan, $application]), ['action' => 'accept'])->assertForbidden();
        $this->actingAs($officer)->post(route('clans.members.update', [$clan, $application]), ['action' => 'accept'])->assertSessionHasNoErrors();

        $this->assertSame(ClanMember::STATUS_ACTIVE, $application->fresh()->status);
        $this->assertSame(3, $clan->fresh()->members_count);
        $this->assertTrue(ConversationParticipant::query()->where('conversation_id', $clan->fresh()->conversation_id)->where('user_id', $applicant->id)->whereNull('left_at')->exists());

        // Офіцер не може підняти до свого рангу, лідер — може.
        $this->actingAs($officer)->post(route('clans.members.update', [$clan, $application]), ['action' => 'rank', 'rank' => 4])->assertSessionHasErrors('rank');
        $this->actingAs($this->leader)->post(route('clans.members.update', [$clan, $application]), ['action' => 'rank', 'rank' => 3])->assertSessionHasNoErrors();
        $this->assertSame(3, $application->fresh()->rank);
    }

    public function test_contributions_need_treasurer_approval(): void
    {
        $clan = $this->clan();
        $user = $this->member($clan);

        $this->actingAs($user)->post(route('clans.contributions.store', $clan), ['amount' => 500, 'comment' => 'На турнір'])->assertSessionHasNoErrors();
        $contribution = ClanContribution::query()->sole();
        $this->assertSame(0, $clan->fresh()->treasury);

        $this->actingAs($user)->post(route('clans.contributions.review', [$clan, $contribution]), ['approve' => true])->assertForbidden();
        $this->actingAs($this->leader)->post(route('clans.contributions.review', [$clan, $contribution]), ['approve' => true])->assertSessionHasNoErrors();

        $this->assertSame(500, $clan->fresh()->treasury);
        $this->assertSame(500, ClanMember::query()->where('user_id', $user->id)->value('contributed'));

        $this->actingAs($this->leader)->post(route('clans.spend', $clan), ['amount' => 900, 'comment' => 'Сервер'])->assertSessionHasErrors('amount');
        $this->actingAs($this->leader)->post(route('clans.spend', $clan), ['amount' => 200, 'comment' => 'Сервер'])->assertSessionHasNoErrors();
        $this->assertSame(300, $clan->fresh()->treasury);
    }

    public function test_disabled_features_are_closed_and_voice_rooms_follow_membership(): void
    {
        $clan = $this->clan('clan', ['news', 'voice']);
        $user = $this->member($clan);

        $this->actingAs($user)->post(route('clans.contributions.store', $clan), ['amount' => 5])->assertNotFound();
        $this->actingAs($user)->post(route('clans.news.store', $clan), ['title' => 'Привіт', 'body' => 'Текст'])->assertForbidden();
        $this->actingAs($this->leader)->post(route('clans.news.store', $clan), ['title' => 'Привіт', 'body' => 'Текст'])->assertSessionHasNoErrors();

        $this->actingAs($user)->getJson(route('voice.index', ['clan', $clan->id]))->assertOk()->assertJsonPath('rooms.0.name', 'Загальна');
        $this->actingAs(User::factory()->create())->getJson(route('voice.index', ['clan', $clan->id]))->assertForbidden();
    }

    public function test_open_clan_lets_people_join_and_leave(): void
    {
        $clan = $this->clan('clan', ['news'], 'open');
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('clans.join', $clan))->assertSessionHasNoErrors();
        $this->assertSame(2, $clan->fresh()->members_count);
        $this->actingAs($user)->post(route('clans.leave', $clan))->assertSessionHasNoErrors();
        $this->assertSame(1, $clan->fresh()->members_count);

        $this->actingAs($this->leader)->post(route('clans.leave', $clan))->assertSessionHasErrors('clan');
    }
}
