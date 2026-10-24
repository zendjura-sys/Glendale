<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Post;
use App\Models\User;
use App\Services\FriendshipService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SocialCoreTest extends TestCase
{
    use RefreshDatabase;

    private function befriend(User $a, User $b): void
    {
        $this->actingAs($a)->post(route('friends.store', $b))->assertRedirect();
        $this->actingAs($b)->post(route('friends.accept', $a))->assertRedirect();
    }

    public function test_guests_see_the_landing_and_members_are_sent_to_the_feed(): void
    {
        $this->get('/')->assertInertia(fn (Assert $page) => $page->component('welcome')->has('stats'));

        $this->actingAs(User::factory()->create())->get('/')->assertRedirect(route('feed'));
    }

    public function test_first_registered_user_becomes_admin_with_generated_username(): void
    {
        $this->post(route('register.store'), [
            'first_name' => 'Олександр',
            'last_name' => 'Коваленко',
            'email' => 'oleksandr@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertRedirect(route('feed', absolute: false));

        $user = User::query()->firstOrFail();
        $this->assertTrue($user->isAdmin());
        $this->assertSame('Олександр Коваленко', $user->name);
        $this->assertMatchesRegularExpression('/^[a-z][a-z0-9_.]*[a-z0-9]$/', $user->username);
    }

    public function test_friend_request_flow_uses_two_way_semantics(): void
    {
        [$anna, $boris] = User::factory()->count(2)->create();
        $service = app(FriendshipService::class);

        $this->actingAs($anna)->post(route('friends.store', $boris));
        $this->assertSame(FriendshipService::OUTGOING, $service->status($anna, $boris));
        $this->assertSame(FriendshipService::INCOMING, $service->status($boris, $anna));

        $this->actingAs($boris)->post(route('friends.accept', $anna));
        $this->assertSame(FriendshipService::FRIENDS, $service->status($anna, $boris));
        $this->assertCount(1, $anna->fresh()->notifications);

        $this->actingAs($boris)->delete(route('friends.destroy', $anna));
        $this->assertSame(FriendshipService::INCOMING, $service->status($boris, $anna));
    }

    public function test_reverse_request_is_auto_accepted(): void
    {
        [$anna, $boris] = User::factory()->count(2)->create();

        $this->actingAs($anna)->post(route('friends.store', $boris));
        $this->actingAs($boris)->post(route('friends.store', $anna));

        $this->assertSame(FriendshipService::FRIENDS, app(FriendshipService::class)->status($anna, $boris));
    }

    public function test_user_can_publish_a_post_with_photo(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $this->actingAs($user)->post(route('posts.store'), [
            'body' => 'Привіт, GameCon!',
            'visibility' => 'public',
            'images' => [UploadedFile::fake()->image('shot.jpg', 1200, 800)],
        ])->assertSessionHasNoErrors();

        $post = Post::query()->with('attachments')->firstOrFail();
        $this->assertSame('Привіт, GameCon!', $post->body);
        $this->assertCount(1, $post->attachments);
        Storage::disk('public')->assertExists($post->attachments->first()->path);
    }

    public function test_empty_post_is_rejected(): void
    {
        $this->actingAs(User::factory()->create())
            ->post(route('posts.store'), ['body' => '', 'visibility' => 'public'])
            ->assertSessionHasErrors('body');
    }

    public function test_only_friends_can_post_on_someone_elses_wall(): void
    {
        [$anna, $boris] = User::factory()->count(2)->create();

        $this->actingAs($anna)
            ->post(route('posts.store'), ['body' => 'Hi', 'visibility' => 'public', 'wall' => $boris->username])
            ->assertForbidden();

        $this->befriend($anna, $boris);

        $this->actingAs($anna)
            ->post(route('posts.store'), ['body' => 'Hi', 'visibility' => 'public', 'wall' => $boris->username])
            ->assertRedirect();

        $this->assertTrue($boris->fresh()->notifications->contains(fn ($n) => $n->data['kind'] === 'wall_post'));
    }

    public function test_post_visibility_is_enforced(): void
    {
        [$author, $friend, $stranger] = User::factory()->count(3)->create();
        $this->befriend($author, $friend);
        $post = Post::factory()->for($author, 'author')->create([
            'wall_type' => 'user',
            'wall_id' => $author->id,
            'visibility' => 'friends',
        ]);

        $this->actingAs($friend)->get(route('posts.show', $post))->assertOk();
        $this->actingAs($stranger)->get(route('posts.show', $post))->assertNotFound();
        $this->actingAs($stranger)->postJson(route('posts.like', $post))->assertNotFound();
    }

    public function test_like_toggles_and_notifies_author(): void
    {
        [$author, $fan] = User::factory()->count(2)->create();
        $post = Post::factory()->for($author, 'author')->create(['wall_type' => 'user', 'wall_id' => $author->id, 'visibility' => 'public']);

        $this->actingAs($fan)->postJson(route('posts.like', $post))->assertJson(['liked' => true, 'likes_count' => 1]);
        $this->actingAs($fan)->postJson(route('posts.like', $post))->assertJson(['liked' => false, 'likes_count' => 0]);
        $this->assertCount(1, $author->fresh()->notifications);
    }

    public function test_comments_can_be_added_replied_and_deleted(): void
    {
        [$author, $guest] = User::factory()->count(2)->create();
        $post = Post::factory()->for($author, 'author')->create(['wall_type' => 'user', 'wall_id' => $author->id, 'visibility' => 'public']);

        $this->actingAs($guest)->postJson(route('comments.store', $post), ['body' => 'Круто!'])->assertSuccessful();
        $comment = Comment::query()->firstOrFail();

        $this->actingAs($author)->postJson(route('comments.store', $post), ['body' => 'Дякую', 'parent_id' => $comment->id])->assertSuccessful();
        $this->assertSame(2, $post->fresh()->comments_count);

        $this->actingAs($author)->deleteJson(route('comments.destroy', $comment))->assertSuccessful();
        $this->assertSoftDeleted($comment);
    }

    public function test_profile_pages_render_by_username_and_id(): void
    {
        $user = User::factory()->create(['username' => 'taras.test']);
        $viewer = User::factory()->create();

        $this->actingAs($viewer)->get('/taras.test')
            ->assertInertia(fn (Assert $page) => $page->component('profile/show')->where('profile.username', 'taras.test'));
        $this->actingAs($viewer)->get("/id{$user->id}")->assertRedirect('/taras.test');
    }

    public function test_private_profile_hides_content_from_non_friends(): void
    {
        $owner = User::factory()->create(['is_private' => true]);
        $stranger = User::factory()->create();

        $this->actingAs($stranger)->get("/{$owner->username}")
            ->assertInertia(fn (Assert $page) => $page->where('canSeeContent', false));
    }

    public function test_feed_people_and_friends_pages_render(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get(route('feed'))->assertInertia(fn (Assert $page) => $page->component('feed/index'));
        $this->actingAs($user)->get(route('friends.index'))->assertOk();
        $this->actingAs($user)->get(route('people.index'))->assertOk();
        $this->actingAs($user)->getJson(route('search.quick', ['q' => 'a']))->assertOk();
    }
}
