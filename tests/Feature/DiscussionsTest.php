<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Movie;
use App\Models\User;
use App\Services\Auth\ApiTokens;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DiscussionsTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $user): string
    {
        return app(ApiTokens::class)->issue($user, 'android');
    }

    public function test_topic_about_game_with_replies_and_likes_in_app_site_and_bridge(): void
    {
        $author = User::factory()->create();
        $reader = User::factory()->create();
        $game = Game::query()->create(['name' => 'Celeste', 'slug' => 'celeste', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);

        $id = $this->withToken($this->token($author))->postJson('/api/v1/discussions', ['type' => 'game', 'id' => $game->id, 'title' => 'Як пройти главу 7?', 'body' => 'Застряг на B-side.'])
            ->assertCreated()->assertJsonPath('discussion.category', 'games')->json('discussion.id');

        // Читач з програми (міст), відповідь і вподобайка.
        $this->withToken($this->token($reader))->getJson("/api/v1/site/discussions/list?type=game&id={$game->id}")
            ->assertOk()->assertJsonPath('subject.title', 'Celeste')->assertJsonPath('discussions.data.0.title', 'Як пройти главу 7?');
        $this->withToken($this->token($reader))->postJson("/api/v1/discussions/{$id}/replies", ['body' => 'Тренуйся на дешах.'])->assertOk();
        $this->withToken($this->token($reader))->postJson("/api/v1/discussions/{$id}/like")->assertOk()->assertJsonPath('liked', true);

        // Сайт: та сама тема з відповіддю.
        $this->actingAs($author)->getJson("/discussions/{$id}")->assertOk()
            ->assertJsonPath('discussion.replies_count', 1)->assertJsonPath('discussion.likes_count', 1)
            ->assertJsonPath('replies.data.0.body', 'Тренуйся на дешах.');
        $this->actingAs($author)->getJson('/discussions/list?category=games')->assertOk()->assertJsonCount(1, 'discussions.data');

        // Чужу тему видалити не можна, свою — можна.
        $this->withToken($this->token($reader))->deleteJson("/api/v1/discussions/{$id}")->assertForbidden();
        $this->actingAs($author)->deleteJson("/discussions/{$id}")->assertOk();
    }

    public function test_movie_topics_land_in_series_and_anime_categories(): void
    {
        $user = User::factory()->create();
        $anime = Movie::query()->create(['slug' => 'bleach', 'type' => 'anime', 'title' => 'Бліч', 'is_published' => true]);
        $this->actingAs($user)->postJson('/discussions', ['type' => 'movie', 'id' => $anime->id, 'title' => 'Найкраща арка?'])->assertCreated()->assertJsonPath('discussion.category', 'anime');
        $this->actingAs($user)->postJson('/discussions', ['category' => 'tech', 'title' => 'Яку відеокарту взяти?'])->assertCreated()->assertJsonPath('discussion.category', 'tech');
        // Розділ можна обрати самому.
        $this->actingAs($user)->postJson('/discussions', ['type' => 'movie', 'id' => $anime->id, 'category' => 'general', 'title' => 'Де дивитися?'])->assertCreated()->assertJsonPath('discussion.category', 'general');
        $this->actingAs($user)->getJson('/discussions/list?category=anime')->assertOk()->assertJsonPath('discussions.data.0.subject_type', 'movie');
    }

    public function test_classic_mode_hides_game_topics(): void
    {
        $classic = User::factory()->create();
        $classic->mergePref(['network_mode' => 'classic']);
        $classic->save();
        $game = Game::query()->create(['name' => 'Celeste', 'slug' => 'celeste', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);

        $this->actingAs($classic)->getJson("/discussions/list?type=game&id={$game->id}")->assertNotFound();
        $this->actingAs($classic)->postJson('/discussions', ['category' => 'games', 'title' => 'Про ігри'])->assertNotFound();
        $this->actingAs($classic)->getJson('/discussions/list')->assertOk()->assertJsonMissingPath('categories.games');
    }

    public function test_topic_embeds_movie_and_game_cards(): void
    {
        $user = User::factory()->create();
        $movie = Movie::query()->create(['slug' => 'matrix', 'type' => 'movie', 'title' => 'Матриця', 'is_published' => true]);
        $game = Game::query()->create(['name' => 'Celeste', 'slug' => 'celeste', 'letter' => 'C', 'category' => 'pc', 'is_published' => true]);
        $this->actingAs($user)->getJson('/discussions/embeds?type=movie&q=Матр')->assertOk()->assertJsonPath('items.0.title', 'Матриця');
        $id = $this->actingAs($user)->postJson('/discussions', ['category' => 'cinema', 'title' => 'Фільми про симуляцію', 'embeds' => [['type' => 'movie', 'id' => $movie->id], ['type' => 'movie', 'id' => 999]]])->assertCreated()->json('discussion.id');
        $this->actingAs($user)->postJson("/discussions/{$id}/replies", ['body' => 'А ще гра', 'embeds' => [['type' => 'game', 'id' => $game->id]]])->assertOk();
        $this->actingAs($user)->getJson("/discussions/{$id}")->assertOk()
            ->assertJsonCount(1, 'discussion.embeds')->assertJsonPath('discussion.embeds.0.title', 'Матриця')
            ->assertJsonPath('replies.data.0.embeds.0.title', 'Celeste');
    }

    public function test_only_staff_pins_and_locks(): void
    {
        $user = User::factory()->create();
        $id = $this->actingAs($user)->postJson('/discussions', ['title' => 'Загальна тема'])->assertCreated()->json('discussion.id');
        $this->actingAs($user)->postJson("/discussions/{$id}/moderate", ['locked' => true])->assertForbidden();
    }
}
