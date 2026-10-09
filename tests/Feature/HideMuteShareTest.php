<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostHide;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class HideMuteShareTest extends TestCase
{
    use RefreshDatabase;

    public function test_hide_mute_and_share_a_post(): void
    {
        $author = User::factory()->create([
            'username' => 'olena',
            'first_name' => 'Олена',
            'last_name' => 'Коваль',
        ]);
        $viewer = User::factory()->create(['username' => 'taras']);
        $stranger = User::factory()->create(['username' => 'marta']);
        $friendships = app(FriendshipService::class);
        $friendships->request($viewer, $author);
        $friendships->accept($author, $viewer);

        $this->actingAs($author)->post(route('posts.store'), [
            'body' => 'Перший запис',
            'visibility' => 'public',
        ])->assertRedirect();
        $this->actingAs($author)->post(route('posts.store'), [
            'body' => 'Другий запис',
            'visibility' => 'public',
            'spoiler' => 1,
        ])->assertRedirect();
        $this->actingAs($stranger)->post(route('posts.store'), [
            'body' => 'Чужий запис',
            'visibility' => 'public',
        ])->assertRedirect();

        $first = Post::query()->where('body', 'Перший запис')->sole();
        $second = Post::query()->where('body', 'Другий запис')->sole();

        $this->actingAs($viewer)->post(route('posts.hide', $first))->assertRedirect();
        $this->actingAs($viewer)->post(route('posts.hide', $first))->assertRedirect();
        $this->assertSame(1, PostHide::query()->count());

        $this->withoutVite()->actingAs($viewer)->get(route('feed', ['tab' => 'friends']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('posts.data', function ($posts) {
                $fromAuthor = collect($posts)->where('author.username', 'olena')->pluck('body');

                return $fromAuthor->all() === ['Другий запис'];
            }));

        $this->withoutVite()->actingAs($viewer)->get(route('feed', ['tab' => 'discover']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('posts.data', function ($posts) {
                $bodies = collect($posts)->pluck('body');

                return $bodies->contains('Чужий запис')
                    && ! $bodies->contains('Перший запис')
                    && ! $bodies->contains('Другий запис');
            }));

        $this->withoutVite()->actingAs($viewer)->get(route('posts.show', $first))->assertOk();

        $this->actingAs($author)->post(route('posts.share', $second))->assertStatus(422);
        $this->actingAs($viewer)->post(route('posts.share', $second))->assertRedirect();

        $copy = Post::query()->where('author_id', $viewer->id)->sole();
        $this->assertSame($second->id, $copy->shared_post_id);
        $this->assertSame('Другий запис', $copy->body);
        $this->assertTrue($copy->spoiler);
        $this->assertTrue($author->fresh()->notifications->contains(
            fn ($note) => ($note->data['kind'] ?? null) === 'post_share' && ($note->data['excerpt'] ?? null) === 'Спойлер',
        ));

        $this->withoutVite()->actingAs($viewer)->get(route('profile.show', $viewer))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('posts.data.0.shared.name', 'Олена Коваль'));

        $third = User::factory()->create();
        $this->actingAs($third)->post(route('posts.share', $copy))->assertRedirect();
        $this->assertSame($second->id, Post::query()->where('author_id', $third->id)->sole()->shared_post_id);

        $this->actingAs($viewer)->post(route('posts.mute', $second))->assertRedirect();
        $this->assertSame(FriendshipService::FRIENDS, $friendships->status($viewer, $author));

        $this->withoutVite()->actingAs($viewer)->get(route('feed', ['tab' => 'friends']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('posts.data', function ($posts) {
                return collect($posts)->where('author.username', 'olena')->isEmpty()
                    && collect($posts)->contains(fn ($post) => ($post['shared']['name'] ?? null) === 'Олена Коваль');
            }));

        $this->withoutVite()->actingAs($viewer)->get(route('profile.show', $author))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('posts.data', function ($posts) {
                return collect($posts)->pluck('body')->sort()->values()->all() === ['Другий запис', 'Перший запис'];
            }));

        $this->actingAs($viewer)->post(route('posts.mute', $second))->assertRedirect();
        $this->withoutVite()->actingAs($viewer)->get(route('feed', ['tab' => 'friends']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('posts.data', function ($posts) {
                return collect($posts)->where('author.username', 'olena')->pluck('body')->all() === ['Другий запис'];
            }));
    }
}
