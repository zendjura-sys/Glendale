<?php

namespace Tests\Feature;

use App\Models\GtaServer;
use App\Models\ServerVote;
use App\Models\User;
use App\Services\Achievements;
use App\Services\Auth\ApiTokens;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ServerVotesTest extends TestCase
{
    use RefreshDatabase;

    private function server(string $slug, ?User $owner = null): GtaServer
    {
        $server = GtaServer::query()->create([
            'slug' => $slug,
            'name' => ucfirst($slug).' RP',
            'platform' => 'pc',
            'multiplayer' => 'ragemp',
            'status' => GtaServer::STATUS_PUBLISHED,
            'origin' => 'seed',
        ]);
        if ($owner) {
            $server->forceFill(['owner_id' => $owner->id])->save();
        }

        return $server;
    }

    public function test_one_vote_a_day_and_the_tops_follow_it(): void
    {
        $this->withoutVite();
        [$alice, $bob, $owner] = User::factory()->count(3)->create();
        $red = $this->server('red', $owner);
        $blue = $this->server('blue');

        $this->actingAs($alice)->post(route('servers.vote', $red))->assertRedirect();
        $this->actingAs($alice)->post(route('servers.vote', $blue))->assertStatus(422);
        $this->actingAs($bob)->post(route('servers.vote', $red))->assertRedirect();
        $this->assertSame(2, ServerVote::query()->count());

        $this->actingAs($alice)->get(route('servers.index', ['sort' => 'votes']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('servers/index')
                ->where('servers.0.slug', 'red')
                ->where('servers.0.votes_month', 2)
                ->where('votes.voted_today', $red->id)
                ->where('votes.day.0.slug', 'red')
                ->where('votes.day.0.votes', 2)
                ->where('votes.month.0.votes', 2));

        // Глядач бачить лічильники, але не розклад по днях; власник — бачить.
        $this->actingAs($alice)->get(route('servers.show', $red))
            ->assertInertia(fn (Assert $page) => $page
                ->where('votes.today', 2)
                ->where('votes.rank', 1)
                ->where('votes.voted_here', true)
                ->where('votes.daily', null));
        $this->actingAs($owner)->get(route('servers.show', $red))
            ->assertInertia(fn (Assert $page) => $page
                ->has('votes.daily', 30)
                ->where('votes.daily.29.votes', 2)
                ->where('votes.voted_today', null));

        // Наступного дня — новий голос.
        Carbon::setTestNow(now()->addDay());
        $this->actingAs($alice)->post(route('servers.vote', $blue))->assertRedirect();
        $this->assertSame(3, ServerVote::query()->count());
        Carbon::setTestNow();
    }

    public function test_votes_give_experience_and_unpublished_servers_cannot_be_voted(): void
    {
        $user = User::factory()->create();
        $hidden = $this->server('hidden');
        $hidden->forceFill(['status' => GtaServer::STATUS_PENDING])->save();
        $this->actingAs($user)->post(route('servers.vote', $hidden))->assertNotFound();

        $before = app(Achievements::class)->for($user)['xp'];
        $this->actingAs($user)->post(route('servers.vote', $this->server('open')))->assertRedirect();
        $this->assertSame($before + 2, app(Achievements::class)->for($user)['xp']);
    }

    public function test_app_votes_through_the_api(): void
    {
        $user = User::factory()->create();
        $server = $this->server('mobile');
        $token = app(ApiTokens::class)->issue($user, 'android');

        $this->withToken($token)->postJson("/api/v1/servers/{$server->slug}/vote")
            ->assertOk()
            ->assertJsonPath('votes.voted_here', true)
            ->assertJsonPath('votes.today', 1);
        $this->withToken($token)->postJson("/api/v1/servers/{$server->slug}/vote")->assertStatus(422);
        $this->withToken($token)->getJson('/api/v1/servers')
            ->assertJsonPath('votes.voted_today', $server->id)
            ->assertJsonPath('servers.0.votes_month', 1);
    }
}
