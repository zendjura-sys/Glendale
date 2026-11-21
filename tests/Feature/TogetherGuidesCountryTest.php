<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\GameGuide;
use App\Models\ListenParty;
use App\Models\ListenPartyMember;
use App\Models\Movie;
use App\Models\Post;
use App\Models\User;
use App\Models\WatchParty;
use App\Models\WatchPartyMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TogetherGuidesCountryTest extends TestCase
{
    use RefreshDatabase;

    public function test_shared_sessions_guides_and_country_feed(): void
    {
        $host = User::factory()->create(['country' => 'UA']);
        $guest = User::factory()->create(['country' => 'UA']);
        $listener = User::factory()->create();
        $movie = Movie::query()->create([
            'slug' => 'matrix-1999', 'type' => 'movie', 'title' => 'Матриця', 'is_published' => true,
        ]);
        $party = WatchParty::query()->create([
            'code' => 'watchtogether1', 'movie_id' => $movie->id, 'host_id' => $host->id,
        ]);
        foreach ([$host, $guest] as $person) {
            WatchPartyMember::query()->create([
                'watch_party_id' => $party->id, 'user_id' => $person->id, 'last_seen_at' => now(),
            ]);
        }
        $listen = ListenParty::query()->create(['code' => 'listentogether', 'host_id' => $host->id]);
        foreach ([$host, $listener] as $person) {
            ListenPartyMember::query()->create([
                'listen_party_id' => $listen->id, 'user_id' => $person->id, 'last_seen_at' => now(),
            ]);
        }

        $this->withoutVite()->actingAs($guest)->withHeader('X-Inertia-Partial-Component', 'profile/show')->get(route('profile.show', $host))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('together', fn ($rows) => collect($rows)->pluck('username')->sort()->values()->all()
                    === collect([$guest->username, $listener->username])->sort()->values()->all()));

        $game = Game::query()->create([
            'slug' => 'nova-drift', 'name' => 'Nova Drift', 'letter' => 'N', 'category' => 'pc', 'is_published' => true,
        ]);
        $this->actingAs($guest)->post(route('games.guides.store', $game), [
            'title' => 'Старт за 10 хвилин',
            'body' => 'Спершу відкрийте укриття, потім зберіть припаси на першій локації.',
        ])->assertRedirect();
        $guide = GameGuide::query()->sole();
        $this->actingAs($host)->getJson(route('games.show', $game))->assertOk()->assertJsonPath('guides.0.title', 'Старт за 10 хвилин');
        $this->actingAs($listener)->delete(route('games.guides.destroy', [$game, $guide]))->assertForbidden();
        $this->actingAs($guest)->delete(route('games.guides.destroy', [$game, $guide]))->assertRedirect();
        $this->assertSame(0, GameGuide::query()->count());

        $this->actingAs($host)->post(route('posts.store'), ['body' => 'Привіт з України', 'visibility' => 'public'])->assertRedirect();
        $polish = User::factory()->create(['country' => 'PL']);
        $this->actingAs($polish)->post(route('posts.store'), ['body' => 'Cześć z Polski', 'visibility' => 'public'])->assertRedirect();

        $this->withoutVite()->actingAs($guest)->get(route('feed', ['tab' => 'country']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tab', 'country')
                ->where('posts.data', fn ($posts) => collect($posts)->pluck('body')->all() === ['Привіт з України']));

        $this->withoutVite()->actingAs($listener)->get(route('feed', ['tab' => 'country']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('posts.data', []));

        $this->assertSame(2, Post::query()->count());
    }

    public function test_guides_are_rated_and_sorted_by_usefulness(): void
    {
        [$author, $other, $a, $b, $c] = User::factory()->count(5)->create();
        $game = Game::query()->create(['name' => 'Factorio', 'slug' => 'factorio', 'letter' => 'F', 'category' => 'pc', 'is_published' => true]);
        $first = GameGuide::query()->create(['game_id' => $game->id, 'user_id' => $author->id, 'title' => 'Старий гід', 'body' => 'Довгий текст гіда для гри.']);
        $second = GameGuide::query()->create(['game_id' => $game->id, 'user_id' => $other->id, 'title' => 'Новий гід', 'body' => 'Ще один текст гіда для гри.']);

        $this->actingAs($author)->postJson(route('games.guides.vote', [$game, $first]), ['helpful' => true])->assertStatus(422);
        foreach ([$a, $b, $c] as $voter) {
            $this->actingAs($voter)->postJson(route('games.guides.vote', [$game, $first]), ['helpful' => true])->assertOk();
        }
        $this->actingAs($a)->postJson(route('games.guides.vote', [$game, $second]), ['helpful' => true])->assertOk();
        // Повторне натискання з іншою думкою — замінює голос, не додає.
        $this->actingAs($a)->postJson(route('games.guides.vote', [$game, $second]), ['helpful' => false])
            ->assertOk()->assertJsonPath('helpful', 0)->assertJsonPath('unhelpful', 1);
        $this->actingAs($b)->postJson(route('games.guides.vote', [$game, $first]), ['helpful' => null])->assertJsonPath('helpful', 2);

        // Старіший, але корисніший гід — угорі; мій голос видно.
        $this->actingAs($a)->getJson(route('games.show', $game))->assertOk()
            ->assertJsonPath('guides.0.title', 'Старий гід')
            ->assertJsonPath('guides.0.helpful', 2)
            ->assertJsonPath('guides.0.my_vote', true)
            ->assertJsonPath('guides.1.my_vote', false);
    }
}
