<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\MovieRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CinemaRequestPlayerTest extends TestCase
{
    use RefreshDatabase;

    public function test_movie_request_preferred_player_and_subtitles(): void
    {
        $this->withoutVite();
        $user = User::factory()->create();
        $movie = Movie::query()->create([
            'slug' => 'dual-player',
            'type' => 'movie',
            'title' => 'Два плеєри',
            'is_published' => true,
        ]);
        $movie->sources()->create([
            'provider' => 'flixcdn',
            'external_id' => 'ru-1',
            'translation' => 'Російська',
            'link' => 'https://example.test/ru',
        ]);
        $movie->sources()->create([
            'provider' => 'kodik',
            'external_id' => 'uk-1',
            'translation' => 'Українська',
            'link' => 'https://example.test/uk',
        ]);
        $movie->sources()->create([
            'provider' => 'custom',
            'external_id' => 'yt-1',
            'translation' => 'English',
            'link' => 'https://www.youtube.com/embed/abcdefghijk',
        ]);

        $user->mergePref(['cinema_player' => 'kodik', 'cinema_subs' => 'uk']);
        $this->actingAs($user)->get(route('cinema.show', $movie))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('players.0.provider', 'kodik')
                ->where('players.0.translation', 'Українська')
                ->where('playback.subs', 'uk'));

        $user->mergePref(['cinema_player' => 'youtube', 'cinema_subs' => 'en']);
        $this->actingAs($user)->get(route('cinema.show', $movie))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('players.0.provider', 'custom'));

        $this->actingAs($user)->put(route('cinema.playback'), ['player' => 'flixcdn', 'subs' => 'ru'])->assertRedirect();
        $this->assertSame('flixcdn', $user->fresh()->pref('cinema_player'));
        $this->assertSame('ru', $user->fresh()->pref('cinema_subs'));

        $this->actingAs($user)->post(route('cinema.requests.store'), ['title' => 'Загублений фільм', 'year' => 1994])->assertRedirect();
        $this->actingAs($user)->post(route('cinema.requests.store'), ['title' => 'Загублений фільм', 'year' => 1995])->assertRedirect();
        $this->assertSame(1, MovieRequest::query()->count());
        $this->assertSame(1995, MovieRequest::query()->first()->year);
    }

    public function test_admin_sees_grouped_requests_and_closes_them(): void
    {
        $this->withoutVite();
        $first = User::factory()->create();
        $second = User::factory()->create();
        $admin = User::factory()->admin()->create();
        $this->actingAs($first)->post(route('cinema.requests.store'), ['title' => 'Загублений фільм', 'year' => 1994])->assertRedirect();
        $this->actingAs($second)->post(route('cinema.requests.store'), ['title' => 'загублений фільм '])->assertRedirect();
        $this->actingAs($second)->post(route('cinema.requests.store'), ['title' => 'Інший'])->assertRedirect();

        $this->actingAs($admin)->get(route('admin.cinema.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('requests', 2)
                ->where('requests.0.count', 2)
                ->where('requests.0.year', 1994));

        $this->actingAs($first)->delete(route('admin.cinema.requests.close'), ['title' => 'Загублений фільм'])->assertForbidden();
        $this->actingAs($admin)->delete(route('admin.cinema.requests.close'), ['title' => 'ЗАГУБЛЕНИЙ ФІЛЬМ'])->assertRedirect();
        $this->assertSame(['Інший'], MovieRequest::query()->pluck('title')->all());
    }
}
