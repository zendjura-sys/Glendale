<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\User;
use App\Services\Cinema\CinemaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TopTenSpoilersTest extends TestCase
{
    use RefreshDatabase;

    public function test_top_ten_rating_follow_and_spoiler_switch(): void
    {
        $this->withoutVite();
        $owner = User::factory()->create(['username' => 'critic']);
        $fan = User::factory()->create();
        $movie = Movie::query()->create([
            'slug' => 'ten-film',
            'type' => 'movie',
            'title' => 'Десятка',
            'is_published' => true,
        ]);

        $this->actingAs($owner)->post(route('cinema.ten.store'), ['movie_id' => $movie->id])->assertRedirect();
        $this->actingAs($owner)->get(route('cinema.ten', $owner))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('movies.0.title', 'Десятка')
                ->where('mine', true));
        $this->actingAs($owner)->post(route('cinema.ten.store'), ['movie_id' => $movie->id])->assertRedirect();
        $this->assertSame([], $owner->fresh()->pref('top_ten'));
        $this->actingAs($owner)->post(route('cinema.ten.store'), ['movie_id' => $movie->id])->assertRedirect();

        $this->actingAs($fan)->post(route('cinema.ratings.follow', $owner))->assertRedirect();
        $this->actingAs($fan)->post(route('cinema.ratings.follow', $fan))->assertStatus(422);
        app(CinemaService::class)->rate($owner, $movie, 9);
        $this->assertSame(1, $fan->notifications()->count());
        $this->assertSame('movie_rating', $fan->notifications()->first()->data['kind']);

        $this->actingAs($fan)->put('/settings/appearance', [
            'palette' => 'ocean',
            'quiet_enabled' => false,
            'quiet_from' => '23:00',
            'quiet_to' => '08:00',
            'languages' => [],
            'looking_for_group' => false,
            'hide_spoilers' => true,
        ])->assertRedirect();
        $this->assertTrue($fan->fresh()->pref('hide_spoilers'));
    }
}
