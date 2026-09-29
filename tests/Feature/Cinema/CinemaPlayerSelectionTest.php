<?php

namespace Tests\Feature\Cinema;

use App\Cinema\Title;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CinemaPlayerSelectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_player_resolves_first_existing_episode_when_switching_seasons(): void
    {
        $title = Title::create([
            'tmdb_id' => 41000, 'type' => 'series', 'name' => 'Серіал',
            'is_published' => true, 'kodik_link' => 'https://kodik.info/serial/example/720p',
        ]);
        $one = $title->seasons()->create(['number' => 1, 'name' => 'Перший', 'episodes_loaded_at' => now()]);
        $four = $title->seasons()->create(['number' => 4, 'name' => 'Четвертий', 'episodes_loaded_at' => now()]);
        $one->episodes()->create(['title_id' => $title->id, 'number' => 1, 'name' => 'Початок']);
        $four->episodes()->create(['title_id' => $title->id, 'number' => 25, 'name' => 'Перша доступна']);
        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=0&season=4")
            ->assertOk()->assertJsonPath('selection.season', 4)->assertJsonPath('selection.episode', 25);
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=0&season=4&episode=99")
            ->assertOk()->assertJsonPath('selection.episode', 25);
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=0&season=1&episode=1")
            ->assertOk()->assertJsonPath('selection.season', 1)->assertJsonPath('selection.episode', 1);
    }

    public function test_unavailable_kodik_does_not_hide_available_flixcdn(): void
    {
        $title = Title::create([
            'tmdb_id' => 41001, 'type' => 'movie', 'name' => 'Інший плеєр',
            'is_published' => true, 'flixcdn_link' => 'https://player.uacdn.live/embed/one',
        ]);
        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/v2/cinema/titles/{$title->id}")
            ->assertOk()->assertJsonPath('translations.0.available', false)
            ->assertJsonPath('translations.1.source', 'flixcdn');
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=0")->assertNotFound();
        $this->getJson("/api/v2/cinema/titles/{$title->id}/player?translation=1")
            ->assertOk()->assertJsonPath('link', 'https://player.uacdn.live/embed/one');
    }
}
