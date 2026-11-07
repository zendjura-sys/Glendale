<?php

namespace Tests\Feature;

use App\Models\Movie;
use App\Models\Track;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MovieListsReviewsTrackTest extends TestCase
{
    use RefreshDatabase;

    private function movie(string $slug): Movie
    {
        return Movie::query()->create(['slug' => $slug, 'type' => 'movie', 'title' => ucfirst($slug), 'is_published' => true]);
    }

    public function test_lists_create_add_like_follow_and_privacy(): void
    {
        $owner = User::factory()->create();
        $fan = User::factory()->create();
        $matrix = $this->movie('matrix');
        $alien = $this->movie('alien');

        $id = $this->actingAs($owner)->postJson('/cinema/lists', ['title' => 'Найкраща фантастика', 'is_public' => true, 'movie' => $matrix->id])
            ->assertOk()->json('list.id');
        $this->actingAs($owner)->postJson("/cinema/lists/{$id}/items", ['movie' => $alien->id, 'on' => true])->assertJsonPath('items_count', 2);
        $this->actingAs($owner)->getJson('/cinema/alien/lists')->assertJsonPath('lists.0.contains', true);
        $this->actingAs($fan)->postJson("/cinema/lists/{$id}/items", ['movie' => $alien->id, 'on' => false])->assertForbidden();
        $this->actingAs($owner)->postJson("/cinema/lists/{$id}/like")->assertStatus(422);
        $this->actingAs($fan)->postJson("/cinema/lists/{$id}/like")->assertJsonPath('liked', true)->assertJsonPath('likes_count', 1);
        $this->actingAs($fan)->postJson("/cinema/lists/{$id}/follow")->assertJsonPath('following', true);
        $this->actingAs($fan)->get('/cinema/lists?tab=following')->assertInertia(fn (Assert $p) => $p->component('cinema/lists')->where('lists.data.0.id', $id));
        $this->actingAs($fan)->get("/cinema/lists/{$id}")->assertInertia(fn (Assert $p) => $p->component('cinema/list')
            ->where('list.liked', true)->where('movies.0.slug', 'matrix')->where('movies.1.slug', 'alien'));

        $this->actingAs($owner)->putJson("/cinema/lists/{$id}", ['title' => 'Тільки для мене', 'is_public' => false])->assertOk();
        $this->actingAs($fan)->get("/cinema/lists/{$id}")->assertNotFound();
    }

    public function test_reviews_rate_hide_spoilers_and_friends_feed(): void
    {
        $author = User::factory()->create();
        $friend = User::factory()->create();
        $stranger = User::factory()->create();
        app(FriendshipService::class)->request($friend, $author);
        app(FriendshipService::class)->accept($author, $friend);
        $movie = $this->movie('matrix');

        $this->actingAs($author)->postJson('/cinema/matrix/reviews', ['body' => 'Коротко', 'score' => 9, 'spoiler' => false])->assertStatus(422);
        $this->actingAs($author)->postJson('/cinema/matrix/reviews', ['body' => 'Нео дізнається правду про Матрицю в кінці — це вражає.', 'score' => 9, 'spoiler' => true])->assertOk();
        $this->assertSame(9, (int) DB::table('movie_user')->where('user_id', $author->id)->where('movie_id', $movie->id)->value('rating'));

        $review = (int) DB::table('movie_reviews')->value('id');
        $this->actingAs($stranger)->postJson("/cinema/reviews/{$review}/like")->assertJsonPath('likes_count', 1);
        $this->actingAs($stranger)->getJson('/cinema/matrix/reviews')->assertJsonPath('summary.count', 1)->assertJsonPath('reviews.data.0.spoiler', true);
        $this->actingAs($friend)->get('/cinema/reviews')->assertInertia(fn (Assert $p) => $p->component('cinema/reviews')->where('reviews.data.0.movie.slug', 'matrix'));
        $this->actingAs($stranger)->get('/cinema/reviews')->assertInertia(fn (Assert $p) => $p->where('reviews.data', []));
        $this->actingAs($stranger)->get('/cinema/reviews?tab=all')->assertInertia(fn (Assert $p) => $p->where('reviews.data.0.id', $review));
    }

    public function test_profile_track_only_from_own_library(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $mine = Track::query()->create(['user_id' => $user->id, 'title' => 'Paparazzi', 'artist' => 'Xzibit', 'duration' => 180, 'path' => 'music/a.mp3', 'mime' => 'audio/mpeg', 'size' => 1]);
        $foreign = Track::query()->create(['user_id' => $other->id, 'title' => 'Hidden', 'artist' => 'X', 'duration' => 180, 'path' => 'music/b.mp3', 'mime' => 'audio/mpeg', 'size' => 1]);

        $this->actingAs($user)->getJson('/settings/profile-track')->assertJsonCount(1, 'tracks');
        $this->actingAs($user)->putJson('/settings/profile-track', ['track_id' => $foreign->id])->assertStatus(422);
        $this->actingAs($user)->putJson('/settings/profile-track', ['track_id' => $mine->id])->assertJsonPath('track.title', 'Paparazzi');
        $this->actingAs($other)->get('/'.$user->username)->assertInertia(fn (Assert $p) => $p->where('profileTrack.title', 'Paparazzi'));
        $this->actingAs($user)->putJson('/settings/profile-track', ['track_id' => null])->assertJsonPath('track', null);
    }
}
