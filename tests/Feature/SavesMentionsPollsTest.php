<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SavesMentionsPollsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_person_can_save_vote_and_mention_someone(): void
    {
        $author = User::factory()->create();
        $friend = User::factory()->create(['username' => 'nova']);
        $game = Game::query()->create([
            'slug' => 'nova-drift',
            'name' => 'Nova Drift',
            'letter' => 'N',
            'category' => 'pc',
            'is_published' => true,
        ]);

        $this->actingAs($author)->postJson('/saved', ['kind' => 'game', 'id' => $game->id])
            ->assertOk()
            ->assertJson(['saved' => true]);
        $this->actingAs($author)->postJson('/saved', ['kind' => 'game', 'id' => $game->id])
            ->assertOk()
            ->assertJson(['saved' => false]);

        $this->actingAs($author)->post(route('posts.store'), [
            'body' => 'Заходь @nova',
            'visibility' => 'public',
            'poll' => ['question' => 'Куди йдемо?', 'options' => ['Рейд', 'Кіно']],
        ])->assertRedirect();

        $post = Post::query()->firstOrFail();
        $this->assertSame('Куди йдемо?', $post->poll?->question);
        $this->assertCount(1, $friend->fresh()->notifications);

        $option = $post->poll->options->firstOrFail();
        $this->actingAs($friend)->postJson(route('posts.poll', $post), ['option_id' => $option->id])
            ->assertOk()
            ->assertJsonPath('voted', $option->id)
            ->assertJsonPath('total', 1);

        $this->actingAs($author)->postJson(route('comments.store', $post), ['body' => 'ще раз @nova'])
            ->assertCreated();
        $this->assertCount(2, $friend->fresh()->notifications);

        $this->actingAs($author)->postJson('/saved', ['kind' => 'post', 'id' => $post->id])->assertJson(['saved' => true]);
        $this->withoutVite()->actingAs($author)->get(route('saved.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('saved/index')->has('items', 1));
    }
}
