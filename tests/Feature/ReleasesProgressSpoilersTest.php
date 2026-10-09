<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameEvent;
use App\Models\Movie;
use App\Models\Post;
use App\Models\User;
use App\Notifications\EventReminder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ReleasesProgressSpoilersTest extends TestCase
{
    use RefreshDatabase;

    public function test_release_reminders_episode_progress_and_spoilers(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $game = Game::query()->create([
            'slug' => 'nova-drift',
            'name' => 'Nova Drift',
            'letter' => 'N',
            'category' => 'pc',
            'is_published' => true,
        ]);
        $today = GameEvent::query()->create([
            'title' => 'Вихід Nova Drift',
            'type' => 'release',
            'starts_at' => now('Europe/Kyiv')->startOfDay()->utc(),
            'all_day' => true,
            'source' => 'manual',
        ]);
        $today->games()->attach($game->id);
        $season = GameEvent::query()->create([
            'title' => 'Сезон 2',
            'type' => 'update',
            'starts_at' => now()->addDays(12),
            'all_day' => true,
            'source' => 'manual',
        ]);
        $season->games()->attach($game->id);

        $this->actingAs($user)->post(route('events.game.rsvp', $today), ['going' => true])->assertRedirect();
        $this->withoutVite()->actingAs($user)->get(route('events.releases'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('releases/index')
                ->where('events.0.remind', true)
                ->where('events.0.title', 'Вихід Nova Drift')
                ->where('events.0.status', 'going')
                ->where('events.1.title', 'Сезон 2'));

        $this->artisan('events:remind')->assertSuccessful();
        Notification::assertSentTo($user, EventReminder::class);
        $this->assertNotNull($today->fresh()?->reminded_at);
        $this->assertNull($season->fresh()?->reminded_at);

        $serial = Movie::query()->create([
            'slug' => 'nova-serial',
            'type' => 'serial',
            'title' => 'Нова',
            'episodes_count' => 12,
            'is_published' => true,
        ]);
        $this->actingAs($user)->putJson(route('cinema.progress', $serial), [
            'season' => 2,
            'episode' => 4,
        ])->assertOk()->assertJsonPath('state.episode', 4)->assertJsonPath('state.season', 2)->assertJsonPath('state.status', 'watching');
        $this->actingAs($user)->putJson(route('cinema.progress', $serial), ['episode' => 99])->assertUnprocessable();
        $this->withoutVite()->actingAs($user)->get(route('cinema.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('rows.0.key', 'continue')
                ->where('rows.0.movies.0.progress.episode', 4)
                ->where('rows.0.movies.0.progress.season', 2));

        $this->actingAs($user)->post(route('posts.store'), [
            'body' => 'Він помирає',
            'visibility' => 'public',
            'spoiler' => true,
        ])->assertRedirect()->assertSessionHasNoErrors();
        $post = Post::query()->sole();
        $this->assertTrue($post->spoiler);
        $this->withoutVite()->actingAs($user)->get(route('posts.show', $post))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('post.spoiler', true)
                ->where('post.body', 'Він помирає'));

        $this->actingAs($user)->postJson(route('cinema.comments.store', $serial), [
            'body' => 'Кінець сезону',
            'spoiler' => true,
        ])->assertCreated()->assertJsonPath('comment.spoiler', true);
    }
}
