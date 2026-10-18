<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Movie;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DraftsPinsStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_short_status_drafts_and_pinned_comments(): void
    {
        $author = User::factory()->create(['status' => 'У рейді']);
        $friend = User::factory()->create(['username' => 'nova']);

        $this->withoutVite()->actingAs($friend)->get(route('profile.show', $author))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('profile.status', 'У рейді')
                ->where('profile.playing', null));

        $this->actingAs($author)->post(route('posts.store'), [
            'body' => 'Чернетка для @nova',
            'visibility' => 'public',
            'draft' => true,
        ])->assertRedirect(route('posts.drafts'));

        $draft = Post::query()->where('is_draft', true)->sole();
        $this->assertCount(0, $friend->fresh()->notifications);
        $this->assertNull(Post::query()->visibleTo($friend, [$author->id])->whereKey($draft->id)->first());
        $this->actingAs($friend)->get(route('posts.show', $draft))->assertNotFound();
        $this->withoutVite()->actingAs($author)->get(route('posts.drafts'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('posts/drafts')
                ->where('drafts.0.body', 'Чернетка для @nova'));

        $this->actingAs($author)->post(route('posts.publish', $draft))->assertRedirect(route('posts.show', $draft));
        $this->assertFalse($draft->fresh()->is_draft);
        $this->assertCount(1, $friend->fresh()->notifications);

        $this->actingAs($friend)->postJson(route('comments.store', $draft), ['body' => 'Беру слот'])->assertCreated();
        $this->actingAs($author)->postJson(route('comments.store', $draft), ['body' => 'Офіційно'])->assertCreated();
        $first = Comment::query()->where('body', 'Беру слот')->sole();
        $second = Comment::query()->where('body', 'Офіційно')->sole();
        $this->actingAs($friend)->postJson(route('comments.pin', $first))->assertForbidden();
        $this->actingAs($author)->postJson(route('comments.pin', $first))->assertOk()->assertJsonPath('is_pinned', true);
        $this->actingAs($author)->postJson(route('comments.pin', $second))->assertOk()->assertJsonPath('is_pinned', true);
        $this->assertFalse($first->fresh()->is_pinned);
        $this->assertTrue($second->fresh()->is_pinned);

        $movie = Movie::query()->create([
            'slug' => 'nova-score',
            'type' => 'movie',
            'title' => 'Нова',
            'is_published' => true,
        ]);
        $this->actingAs($friend)->postJson(route('cinema.comments.store', $movie), ['body' => 'Без спойлерів'])->assertCreated();
        $movieComment = Comment::query()->where('movie_id', $movie->id)->sole();
        $this->actingAs($friend)->postJson(route('comments.pin', $movieComment))->assertForbidden();
        $this->actingAs(User::factory()->admin()->create())->postJson(route('comments.pin', $movieComment))
            ->assertOk()
            ->assertJsonPath('is_pinned', true);
        $this->assertTrue($movieComment->fresh()->is_pinned);
    }
}
