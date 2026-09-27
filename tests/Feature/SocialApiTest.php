<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SocialApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $first = 'Тест'): User
    {
        return User::factory()->create(['first_name' => $first, 'last_name' => 'Monsory']);
    }

    public function test_guest_gets_json_401(): void
    {
        $this->get('/api/v2/me')->assertStatus(401)->assertJson(['message' => 'Unauthenticated.']);
        $this->get('/api/v2/config')->assertOk()->assertJsonStructure(['siteTitle', 'accentColor']);
    }

    public function test_me_returns_profile_level_and_counters(): void
    {
        $user = $this->user('Олена');
        Sanctum::actingAs($user);

        $this->getJson('/api/v2/me')->assertOk()
            ->assertJsonPath('user.firstName', 'Олена')
            ->assertJsonPath('user.level.type', 'user')
            ->assertJsonStructure(['counters' => ['messages', 'friends', 'notifications']]);
    }

    public function test_post_appears_on_wall_and_in_friends_feed(): void
    {
        $author = $this->user('Автор');
        $friend = $this->user('Друг');
        $stranger = $this->user('Чужий');

        Sanctum::actingAs($author);
        $post = $this->postJson('/api/v2/posts', ['text' => 'Привіт, родино'])->assertCreated()->json();
        $this->assertSame('Привіт, родино', $post['text']);
        $this->assertTrue($post['canDelete']);

        // Дружба: заявка → прийняття.
        $this->postJson("/api/v2/friends/{$friend->id}")->assertJsonPath('friendship', 'outgoing');
        Sanctum::actingAs($friend);
        $this->postJson("/api/v2/friends/{$author->id}")->assertJsonPath('friendship', 'friends');
        $this->getJson('/api/v2/feed')->assertOk()->assertJsonPath('items.0.id', $post['id']);

        // Чужий не бачить у «Новинах», але бачить у «Рекомендаціях».
        Sanctum::actingAs($stranger);
        $this->getJson('/api/v2/feed')->assertJsonCount(0, 'items');
        $this->getJson('/api/v2/feed?tab=popular')->assertJsonPath('items.0.id', $post['id']);
        // І не може видалити чужий запис.
        $this->deleteJson("/api/v2/posts/{$post['id']}")->assertForbidden();
    }

    public function test_like_comment_and_repost_notify_author(): void
    {
        $author = $this->user('Автор');
        $fan = $this->user('Фанат');
        Sanctum::actingAs($author);
        $post = $this->postJson('/api/v2/posts', ['text' => 'Запис'])->json();

        Sanctum::actingAs($fan);
        $this->postJson("/api/v2/posts/{$post['id']}/like")->assertJsonPath('likes', 1)->assertJsonPath('liked', true);
        $this->postJson("/api/v2/posts/{$post['id']}/comments", ['text' => 'Круто'])->assertCreated();
        $this->postJson("/api/v2/posts/{$post['id']}/repost")->assertCreated()->assertJsonPath('repost.id', $post['id']);
        $this->postJson("/api/v2/posts/{$post['id']}/repost")->assertStatus(409);

        Sanctum::actingAs($author);
        $this->getJson('/api/v2/counters')->assertJsonPath('notifications', 3);
        $types = collect($this->getJson('/api/v2/notifications')->json('items'))->pluck('type')->sort()->values()->all();
        $this->assertSame(['comment', 'like', 'repost'], $types);
        $this->getJson("/api/v2/posts/{$post['id']}")->assertJsonPath('comments', 1)->assertJsonPath('reposts', 1);
    }

    public function test_closed_group_content_is_hidden_from_non_members(): void
    {
        $owner = $this->user('Власник');
        $outsider = $this->user('Сторонній');

        Sanctum::actingAs($owner);
        $group = $this->postJson('/api/v2/groups', ['name' => 'Закрита рада', 'privacy' => 'closed'])->assertCreated()->json();
        $post = $this->postJson('/api/v2/posts', ['text' => 'Секрет', 'ownerType' => 'group', 'ownerId' => $group['id']])->assertCreated()->json();

        Sanctum::actingAs($outsider);
        $this->getJson("/api/v2/wall/group/{$group['id']}")->assertForbidden()->assertJsonPath('code', 'closed_group');
        $this->getJson("/api/v2/posts/{$post['id']}")->assertForbidden();
        $this->getJson('/api/v2/feed?tab=popular')->assertJsonCount(0, 'items');
        // Не адміністратор не публікує від імені спільноти.
        $this->postJson('/api/v2/posts', ['text' => 'x', 'ownerType' => 'group', 'ownerId' => $group['id']])->assertForbidden();

        // Заявка → власник схвалює → вміст відкривається.
        $this->postJson("/api/v2/groups/{$group['id']}/join")->assertJsonPath('requested', true);
        Sanctum::actingAs($owner);
        $this->postJson("/api/v2/groups/{$group['id']}/requests/{$outsider->id}")->assertOk();
        Sanctum::actingAs($outsider);
        $this->getJson("/api/v2/wall/group/{$group['id']}")->assertOk()->assertJsonPath('items.0.id', $post['id']);
    }

    public function test_avatar_upload_stores_photo(): void
    {
        Storage::fake('public');
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->post('/api/v2/me/avatar', ['image' => UploadedFile::fake()->image('a.jpg')], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('id', $user->id);
        $this->assertNotNull($user->fresh()->avatar_path);
        $this->getJson("/api/v2/users/{$user->id}/photos")->assertJsonCount(1, 'items');
    }

    public function test_shadow_accounts_are_not_social_profiles(): void
    {
        $me = $this->user();
        $shadow = User::createShadow('Тінь', 'Акаунт');
        Sanctum::actingAs($me);

        $this->getJson("/api/v2/users/{$shadow->id}")->assertNotFound();
        $this->assertNotContains($shadow->id, collect($this->getJson('/api/v2/friends/suggestions')->json())->pluck('id'));
    }

    public function test_session_bridge_issues_token_only_for_signed_in_user(): void
    {
        $this->postJson('/social/session-token')->assertStatus(401);

        $user = $this->user();
        $token = $this->actingAs($user)->postJson('/social/session-token')->assertOk()->json('token');
        $this->assertNotEmpty($token);

        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/v2/me')->assertJsonPath('user.id', $user->id);
    }

    public function test_spa_page_renders_for_guests(): void
    {
        $this->get('/social/feed')->assertOk()->assertSee('window.APP_BASE', false);
    }
}
