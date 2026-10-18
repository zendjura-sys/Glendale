<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\User;
use App\Services\Cinema\CinemaService;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class EpisodeTasteTest extends TestCase
{
    use RefreshDatabase;

    public function test_episode_marks_seen_friends_and_shared_high_ratings(): void
    {
        $this->withoutVite();
        $viewer = User::factory()->create();
        $seen = User::factory()->create(['username' => 'seenfriend', 'first_name' => 'Олена', 'last_name' => 'Коваль']);
        $planned = User::factory()->create(['username' => 'laterfriend']);
        $friends = app(FriendshipService::class);
        foreach ([$seen, $planned] as $friend) {
            $friends->request($viewer, $friend);
            $friends->accept($friend, $viewer);
        }

        $serial = Movie::query()->create([
            'slug' => 'serial-one',
            'type' => 'serial',
            'title' => 'Серіал',
            'episodes_count' => 4,
            'is_published' => true,
        ]);
        $other = Movie::query()->create([
            'slug' => 'other-film',
            'type' => 'movie',
            'title' => 'Інший',
            'is_published' => true,
        ]);
        $cinema = app(CinemaService::class);
        $cinema->setStatus($seen, $serial, 'watched');
        $cinema->setStatus($planned, $serial, 'planned');
        $cinema->rate($viewer, $serial, 9);
        $cinema->rate($viewer, $other, 9);
        $cinema->rate($seen, $serial, 10);
        $cinema->rate($seen, $other, 8);
        $cinema->rate($planned, $serial, 5);

        $this->actingAs($viewer)->postJson(route('cinema.episodes', $serial), ['season' => 1, 'episode' => 2])
            ->assertOk()
            ->assertJsonPath('marks.0', '1:2');
        $this->actingAs($viewer)->postJson(route('cinema.episodes', $serial), ['season' => 1, 'episode' => 2])
            ->assertOk()
            ->assertJsonPath('marks', []);
        $this->actingAs($viewer)->postJson(route('cinema.episodes', $serial), ['season' => 2, 'episode' => 1])->assertOk();
        $this->assertSame(1, DB::table('movie_episode_marks')->count());

        $this->actingAs($viewer)->get(route('cinema.show', $serial))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('episodeMarks', ['2:1'])
                ->where('seen.0.username', 'seenfriend')
                ->where('seen', fn ($rows) => collect($rows)->pluck('username')->all() === ['seenfriend'])
                ->where('taste.0.username', 'seenfriend')
                ->where('taste.0.shared', 2));
    }
}
