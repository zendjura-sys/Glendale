<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Movie;
use App\Models\User;
use App\Services\Cinema\CinemaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SavedPopularWatchTest extends TestCase
{
    use RefreshDatabase;

    public function test_saved_search_popular_titles_and_watch_later_row(): void
    {
        $this->withoutVite();
        $user = User::factory()->create();
        $later = Movie::query()->create([
            'slug' => 'later-film',
            'type' => 'movie',
            'title' => 'Пізніше',
            'is_published' => true,
        ]);
        $now = Movie::query()->create([
            'slug' => 'now-film',
            'type' => 'movie',
            'title' => 'Зараз',
            'is_published' => true,
        ]);
        $now->forceFill(['views_count' => 12])->save();
        $cinema = app(CinemaService::class);
        $cinema->setStatus($user, $later, 'planned');
        $cinema->setStatus($user, $now, 'watching');

        $this->actingAs($user)->get(route('cinema.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('rows.0.key', 'continue')
                ->where('rows.0.movies.0.title', 'Зараз')
                ->where('rows.1.key', 'later')
                ->where('rows.1.movies.0.title', 'Пізніше'));

        Game::query()->create([
            'slug' => 'nova-drift',
            'name' => 'Nova Drift',
            'letter' => 'N',
            'category' => 'pc',
            'is_published' => true,
            'popularity' => 40,
        ]);

        $this->actingAs($user)->getJson(route('search.quick'))
            ->assertOk()
            ->assertJsonFragment(['kind' => 'game', 'title' => 'Nova Drift'])
            ->assertJsonFragment(['kind' => 'movie', 'title' => 'Зараз']);

        $this->actingAs($user)->post(route('people.saved'), [
            'country' => 'Україна',
            'language' => 'uk',
            'online' => 1,
            'game' => 'Nova',
        ])->assertRedirect();

        $this->actingAs($user)->get(route('people.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('saved.country', 'Україна')
                ->where('saved.language', 'uk')
                ->where('saved.online', true)
                ->where('saved.game', 'Nova'));
    }
}
