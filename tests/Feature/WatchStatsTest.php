<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\User;
use App\Services\Cinema\WatchStats;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** №272: статистика перегляду в профілі. */
class WatchStatsTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_shows_watch_stats(): void
    {
        $user = User::factory()->create(['username' => 'kinoman']);
        $film = Movie::query()->create(['slug' => 'dune', 'type' => 'movie', 'title' => 'Дюна', 'is_published' => true, 'duration' => 155, 'genres' => ['фантастика', 'драма']]);
        $show = Movie::query()->create(['slug' => 'arcane', 'type' => 'series', 'title' => 'Аркейн', 'is_published' => true, 'duration' => 40, 'genres' => ['фантастика', 'анімація']]);
        DB::table('movie_user')->insert([
            ['user_id' => $user->id, 'movie_id' => $film->id, 'status' => 'watched', 'rating' => 9, 'watched_at' => now(), 'created_at' => now(), 'updated_at' => now()],
            ['user_id' => $user->id, 'movie_id' => $show->id, 'status' => 'watching', 'rating' => 8, 'watched_at' => null, 'created_at' => now(), 'updated_at' => now()],
        ]);
        foreach ([1, 2, 3] as $episode) {
            DB::table('movie_episode_marks')->insert(['user_id' => $user->id, 'movie_id' => $show->id, 'season' => 1, 'episode' => $episode]);
        }

        $stats = app(WatchStats::class)->of($user);
        $this->assertSame(1, $stats['watched']);
        $this->assertSame(1, $stats['watching']);
        $this->assertSame(3, $stats['episodes']);
        $this->assertSame(5, $stats['hours']); // 155 хв + 3 × 40 хв ≈ 4,6 год.
        $this->assertSame(8.5, $stats['avg_rating']);
        $this->assertSame('фантастика', $stats['genres'][0]['name']);
        $this->assertSame(1, $stats['this_year']);

        $this->assertNull(app(WatchStats::class)->of(User::factory()->create()));

        $this->actingAs(User::factory()->create())->get('/kinoman')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload->where('cinemaStats.episodes', 3)));
    }
}
