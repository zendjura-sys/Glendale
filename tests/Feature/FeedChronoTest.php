<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Friendship;
use App\Models\Post;
use App\Models\User;
use App\Services\CommunityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Вкладка «Друзі»: строго за часом, перемикач «Лише друзі» без спільнот запам’ятовується. */
class FeedChronoTest extends TestCase
{
    use RefreshDatabase;

    public function test_friends_tab_is_chronological_and_only_friends_hides_communities(): void
    {
        $me = User::factory()->create();
        $friend = User::factory()->create();
        Friendship::query()->create(['requester_id' => $me->id, 'addressee_id' => $friend->id, 'status' => Friendship::ACCEPTED, 'accepted_at' => now()]);
        $community = app(CommunityService::class)->create($me, ['name' => 'Новини', 'type' => Community::TYPE_GROUP, 'privacy' => Community::PRIVACY_OPEN, 'wall' => Community::WALL_OPEN, 'category' => 'esports']);

        $old = Post::query()->create(['author_id' => $friend->id, 'wall_type' => 'user', 'wall_id' => $friend->id, 'body' => 'Старий', 'visibility' => 'public']);
        $old->forceFill(['likes_count' => 100])->save();
        $group = Post::query()->create(['author_id' => $me->id, 'wall_type' => 'community', 'wall_id' => $community->id, 'body' => 'Зі спільноти', 'visibility' => 'public']);
        $new = Post::query()->create(['author_id' => $friend->id, 'wall_type' => 'user', 'wall_id' => $friend->id, 'body' => 'Новий', 'visibility' => 'public']);

        // Популярний старий запис не обганяє свіжі — порядок лише за часом.
        $this->actingAs($me)->get('/feed')->assertInertia(fn (Assert $page) => $page
            ->where('onlyFriends', false)
            ->where('posts.data', fn ($posts) => collect($posts)->pluck('id')->all() === [$new->id, $group->id, $old->id]));

        $this->actingAs($me)->get('/feed?only=friends')->assertInertia(fn (Assert $page) => $page
            ->where('onlyFriends', true)
            ->where('posts.data', fn ($posts) => collect($posts)->pluck('id')->all() === [$new->id, $old->id]));
        // Вибір запам’ятовано.
        $this->actingAs($me->refresh())->get('/feed')->assertInertia(fn (Assert $page) => $page->where('onlyFriends', true));
        $this->actingAs($me)->get('/feed?only=all')->assertInertia(fn (Assert $page) => $page->where('onlyFriends', false));
    }
}
