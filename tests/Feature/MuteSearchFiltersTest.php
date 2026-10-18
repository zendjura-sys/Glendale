<?php

namespace Tests\Feature;

use App\Models\Follow;
use App\Models\Game;
use App\Models\Post;
use App\Models\User;
use App\Notifications\Mention;
use App\Notifications\PostInteraction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MuteSearchFiltersTest extends TestCase
{
    use RefreshDatabase;

    public function test_muted_words_recent_searches_and_people_filters(): void
    {
        $this->withoutVite();
        $viewer = User::factory()->create();
        $author = User::factory()->create();
        Post::factory()->create([
            'author_id' => $author->id,
            'wall_type' => 'user',
            'wall_id' => $author->id,
            'body' => 'це спойлер сюжету',
            'visibility' => 'public',
        ]);
        Post::factory()->create([
            'author_id' => $author->id,
            'wall_type' => 'user',
            'wall_id' => $author->id,
            'body' => 'Звичайний запис',
            'visibility' => 'public',
        ]);

        $this->actingAs($viewer)->put('/settings/appearance', [
            'palette' => 'ocean',
            'quiet_enabled' => false,
            'quiet_from' => '23:00',
            'quiet_to' => '08:00',
            'languages' => [],
            'looking_for_group' => false,
            'mute_words' => ['спойлер', 'спойлер'],
        ])->assertRedirect();
        $this->assertSame(['спойлер'], $viewer->fresh()->pref('mute_words'));

        $this->actingAs($viewer)->get(route('feed'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where(
                'posts.data',
                fn ($posts) => collect($posts)->pluck('body')->all() === ['Звичайний запис'],
            ));

        $spoiled = Post::query()->where('body', 'це спойлер сюжету')->firstOrFail();
        $clean = Post::query()->where('body', 'Звичайний запис')->firstOrFail();
        $viewer->notify(new PostInteraction(PostInteraction::COMMENT, $author, $spoiled, 'дивись'));
        $viewer->notify(new Mention($author, '/feed', 'спойлер фіналу'));
        $this->assertSame(0, $viewer->notifications()->count());
        $viewer->notify(new PostInteraction(PostInteraction::COMMENT, $author, $clean, 'класно'));
        $this->assertSame(1, $viewer->notifications()->count());

        $this->actingAs($viewer)->postJson(route('search.recent'), ['q' => 'Nova'])->assertOk();
        $this->actingAs($viewer)->postJson(route('search.recent'), ['q' => 'Матриця'])->assertOk();
        $this->actingAs($viewer)->postJson(route('search.recent'), ['q' => 'nova'])
            ->assertOk()
            ->assertJsonPath('recent.0', 'nova')
            ->assertJsonPath('recent.1', 'Матриця');
        $this->actingAs($viewer)->getJson(route('search.quick'))
            ->assertOk()
            ->assertJsonPath('recent.0', 'nova')
            ->assertJsonCount(2, 'recent');

        $game = Game::query()->create([
            'slug' => 'nova-drift',
            'name' => 'Nova Drift',
            'letter' => 'N',
            'category' => 'pc',
            'is_published' => true,
        ]);
        $online = User::factory()->create(['username' => 'onlineua', 'country' => 'Україна']);
        $online->mergePref(['languages' => ['uk']]);
        $online->forceFill([
            'last_seen_at' => now(),
            'playing_kind' => 'game',
            'playing_label' => 'Nova Drift',
            'playing_until' => now()->addHour(),
        ])->save();
        $follower = User::factory()->create(['username' => 'follower', 'country' => 'Україна']);
        $follower->mergePref(['languages' => ['uk']]);
        $follower->forceFill(['last_seen_at' => now()->subDay()])->save();
        Follow::query()->create(['user_id' => $follower->id, 'kind' => Follow::GAME, 'subject_id' => $game->id]);
        $stranger = User::factory()->create(['username' => 'stranger', 'country' => 'Польща']);
        $stranger->mergePref(['languages' => ['pl']]);
        $stranger->forceFill(['last_seen_at' => now()])->save();

        $this->actingAs($viewer)->get(route('people.index', [
            'online' => 1,
            'country' => 'Україна',
            'language' => 'uk',
            'game' => 'Nova',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('users.data', 1)
            ->where('users.data.0.username', 'onlineua'));

        $this->actingAs($viewer)->get(route('people.index', [
            'country' => 'Україна',
            'language' => 'uk',
            'game' => 'Nova',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page->has('users.data', 2));
    }
}
