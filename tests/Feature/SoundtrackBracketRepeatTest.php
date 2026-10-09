<?php

namespace Tests\Feature;

use App\Models\Clan;
use App\Models\ClanEvent;
use App\Models\Game;
use App\Models\Movie;
use App\Models\Track;
use App\Models\User;
use App\Services\Games\GameCatalog;
use App\Services\RecurringEvents;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SoundtrackBracketRepeatTest extends TestCase
{
    use RefreshDatabase;

    public function test_soundtrack_bracket_and_weekly_events(): void
    {
        app(GameCatalog::class)->seed();
        $admin = User::factory()->admin()->create();
        $viewer = User::factory()->create();
        $movie = Movie::query()->create([
            'slug' => 'nova-score',
            'type' => 'movie',
            'title' => 'Нова',
            'is_published' => true,
        ]);
        $track = Track::query()->create([
            'user_id' => $admin->id,
            'title' => 'Night Run',
            'artist' => 'Nova',
            'duration' => 180,
            'path' => 'tracks/night.mp3',
            'size' => 10,
        ]);

        $this->actingAs($viewer)->post(route('cinema.soundtrack.store', $movie), ['track_id' => $track->id])->assertForbidden();
        $this->actingAs($admin)->post(route('cinema.soundtrack.store', $movie), ['track_id' => $track->id])->assertRedirect();
        $this->actingAs($admin)->post(route('cinema.soundtrack.store', $movie), ['track_id' => $track->id])->assertRedirect();
        $this->assertSame(1, $movie->tracks()->count());
        $this->withoutVite()->actingAs($viewer)->get(route('cinema.show', $movie))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('soundtrack.0.title', 'Night Run')
                ->where('soundtrack.0.artist', 'Nova'));

        $leader = User::factory()->create();
        $gameId = Game::query()->where('slug', 'counter-strike-2')->value('id');
        $this->actingAs($leader)->post(route('clans.store'), [
            'type' => 'clan',
            'name' => 'Natus Vincere',
            'tag' => 'navi',
            'game_id' => $gameId,
            'features' => ['events'],
            'join_mode' => 'open',
        ])->assertRedirect();
        $clan = Clan::query()->latest('id')->firstOrFail();
        $this->actingAs($leader)->post(route('clans.events.store', $clan), [
            'title' => 'Рейд',
            'starts_at' => now()->addDay()->format('Y-m-d\TH:i'),
            'weekly' => true,
        ])->assertRedirect()->assertSessionHasNoErrors();
        $event = ClanEvent::query()->where('clan_id', $clan->id)->firstOrFail();
        $this->assertSame('weekly', $event->repeat);

        $this->actingAs($leader)->post(route('clans.events.bracket', [$clan, $event]), [
            'teams' => ['Alpha', 'Beta', 'Gamma', 'Delta'],
            'semi' => [[2, 0], [1, 3]],
            'final' => [2, 1],
        ])->assertRedirect()->assertSessionHasNoErrors();
        $this->assertSame(['Alpha', 'Beta', 'Gamma', 'Delta'], $event->fresh()?->bracket['teams'] ?? null);

        $event->forceFill(['starts_at' => now()->subHour(), 'spawned_at' => null])->save();
        $this->assertSame(1, app(RecurringEvents::class)->spawn());
        $this->assertNotNull($event->fresh()?->spawned_at);
        $next = ClanEvent::query()->where('clan_id', $clan->id)->whereNull('spawned_at')->firstOrFail();
        $this->assertSame('Рейд', $next->title);
        $this->assertSame('weekly', $next->repeat);
        $this->assertNull($next->bracket);
        $this->assertTrue($next->starts_at->greaterThan(now()->addDays(6)));
    }
}
