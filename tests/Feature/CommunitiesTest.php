<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\CommunityMember;
use App\Models\Post;
use App\Models\User;
use App\Notifications\CommunityActivity;
use App\Services\CommunityService;
use App\Support\Modules\ModuleManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CommunitiesTest extends TestCase
{
    use RefreshDatabase;

    private function community(User $owner, array $data = []): Community
    {
        return app(CommunityService::class)->create($owner, [
            'name' => 'Кіберспорт UA',
            'type' => Community::TYPE_GROUP,
            'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_OPEN,
            'category' => 'esports',
            ...$data,
        ]);
    }

    public function test_user_creates_a_community_and_becomes_its_owner(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('communities.store'), [
            'name' => 'Ретро ігри',
            'type' => Community::TYPE_PUBLIC,
            'category' => 'games',
            'privacy' => Community::PRIVACY_CLOSED,
        ]);

        $community = Community::query()->sole();
        $response->assertRedirect(route('communities.show', $community));

        $this->assertSame('retro_igri', $community->slug);
        $this->assertSame(Community::PRIVACY_OPEN, $community->privacy, 'Публічні сторінки завжди відкриті');
        $this->assertSame(1, $community->members_count);
        $this->assertSame(CommunityMember::ROLE_OWNER, $community->membershipFor($user)->role);
    }

    public function test_joining_open_and_closed_communities(): void
    {
        Notification::fake();
        [$owner, $guest] = User::factory()->count(2)->create();
        $open = $this->community($owner);
        $closed = $this->community($owner, ['name' => 'Закритий клуб', 'privacy' => Community::PRIVACY_CLOSED]);

        $this->actingAs($guest)->post(route('communities.join', $open))->assertRedirect();
        $this->assertTrue($open->membershipFor($guest)->isActive());
        $this->assertSame(2, $open->fresh()->members_count);

        $this->actingAs($guest)->post(route('communities.join', $closed));
        $this->assertSame(CommunityMember::STATUS_PENDING, $closed->membershipFor($guest)->status);
        $this->assertSame(1, $closed->fresh()->members_count);
        Notification::assertSentTo($owner, CommunityActivity::class);

        $this->actingAs($owner)->post(route('communities.members.approve', [$closed, $guest]))->assertRedirect();
        $this->assertTrue($closed->membershipFor($guest)->isActive());
        Notification::assertSentTo($guest, CommunityActivity::class);
    }

    public function test_owner_cannot_leave_and_members_can(): void
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $community = $this->community($owner);
        app(CommunityService::class)->join($community, $member);

        $this->actingAs($owner)->delete(route('communities.leave', $community))->assertSessionHasErrors();
        $this->assertNotNull($community->membershipFor($owner));

        $this->actingAs($member)->delete(route('communities.leave', $community));
        $this->assertNull($community->membershipFor($member));
        $this->assertSame(1, $community->fresh()->members_count);
    }

    public function test_closed_community_hides_posts_from_outsiders(): void
    {
        [$owner, $outsider] = User::factory()->count(2)->create();
        $community = $this->community($owner, ['privacy' => Community::PRIVACY_CLOSED]);

        $this->actingAs($owner)->post(route('posts.store'), [
            'body' => 'Секретний анонс',
            'visibility' => Post::VISIBILITY_PUBLIC,
            'community' => $community->slug,
        ])->assertRedirect();

        $post = Post::query()->sole();

        $this->actingAs($outsider)->get(route('communities.show', $community))
            ->assertInertia(fn (Assert $page) => $page->where('can.view', false)->has('posts.data', 0));
        $this->actingAs($outsider)->get(route('posts.show', $post))->assertNotFound();
        $this->actingAs($owner)->get(route('communities.show', $community))
            ->assertInertia(fn (Assert $page) => $page->has('posts.data', 1));
    }

    public function test_public_page_posts_are_published_as_community_and_only_by_managers(): void
    {
        [$owner, $member] = User::factory()->count(2)->create();
        $page = $this->community($owner, ['type' => Community::TYPE_PUBLIC, 'wall' => Community::WALL_CLOSED]);
        app(CommunityService::class)->join($page, $member);

        $this->actingAs($member)->post(route('posts.store'), [
            'body' => 'Можна мені?',
            'visibility' => Post::VISIBILITY_PUBLIC,
            'community' => $page->slug,
        ])->assertForbidden();

        $this->actingAs($owner)->post(route('posts.store'), [
            'body' => 'Новина дня',
            'visibility' => Post::VISIBILITY_FRIENDS,
            'community' => $page->slug,
        ]);

        $post = Post::query()->sole();
        $this->assertTrue($post->as_community);
        $this->assertSame(Post::VISIBILITY_PUBLIC, $post->visibility);

        $this->actingAs($member)->get(route('feed', ['tab' => 'friends']))
            ->assertInertia(fn (Assert $p) => $p->where('posts.data.0.publisher.name', $page->name));
    }

    public function test_managers_can_moderate_the_wall(): void
    {
        [$owner, $editor, $member] = User::factory()->count(3)->create();
        $community = $this->community($owner);
        $service = app(CommunityService::class);
        $service->join($community, $editor);
        $service->join($community, $member);

        $this->actingAs($member)->patch(route('communities.members.role', [$community, $editor]), ['role' => 'editor'])->assertForbidden();
        $this->actingAs($owner)->patch(route('communities.members.role', [$community, $editor]), ['role' => 'editor'])->assertRedirect();
        $this->assertSame(CommunityMember::ROLE_EDITOR, $community->membershipFor($editor)->role);

        $this->actingAs($member)->post(route('posts.store'), [
            'body' => 'Спам',
            'visibility' => Post::VISIBILITY_PUBLIC,
            'community' => $community->slug,
        ]);
        $post = Post::query()->sole();

        $this->actingAs($editor)->delete(route('posts.destroy', $post))->assertRedirect();
        $this->assertSoftDeleted($post);
    }

    public function test_settings_are_restricted_to_admins_and_slug_is_validated(): void
    {
        [$owner, $member, $other] = User::factory()->count(3)->create();
        $community = $this->community($owner);
        $this->community($other, ['name' => 'Чужа', 'slug' => 'taken']);
        app(CommunityService::class)->join($community, $member);

        $this->actingAs($member)->get(route('communities.edit', $community))->assertForbidden();

        $payload = [
            'name' => 'Нова назва',
            'type' => Community::TYPE_GROUP,
            'privacy' => Community::PRIVACY_OPEN,
            'wall' => Community::WALL_CLOSED,
            'category' => 'games',
        ];

        $this->actingAs($owner)->patch(route('communities.update', $community), [...$payload, 'slug' => 'taken'])->assertSessionHasErrors('slug');
        $this->actingAs($owner)->patch(route('communities.update', $community), [...$payload, 'slug' => 'admin'])->assertSessionHasErrors('slug');
        $this->actingAs($owner)->patch(route('communities.update', $community), [...$payload, 'slug' => 'new_slug'])
            ->assertRedirect(route('communities.edit', 'new_slug'));

        $this->assertSame('Нова назва', $community->fresh()->name);
    }

    public function test_owner_deletes_community_with_confirmation(): void
    {
        $owner = User::factory()->create();
        $community = $this->community($owner);

        $this->actingAs($owner)->delete(route('communities.destroy', $community), ['confirm' => 'wrong'])->assertSessionHasErrors('confirm');
        $this->actingAs($owner)->delete(route('communities.destroy', $community), ['confirm' => $community->slug])
            ->assertRedirect(route('communities.index'));

        $this->assertSoftDeleted($community);
    }

    public function test_admin_verifies_trashes_and_restores_communities(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $community = $this->community(User::factory()->create());

        $this->actingAs($admin)->get(route('admin.communities.index'))
            ->assertInertia(fn (Assert $page) => $page->component('admin/communities')->where('stats.total', 1));

        $this->actingAs($admin)->patch(route('admin.communities.update', $community), ['is_verified' => true]);
        $this->assertTrue($community->fresh()->is_verified);

        $this->actingAs($admin)->delete(route('admin.communities.destroy', $community->id));
        $this->assertSoftDeleted($community);

        $this->actingAs($admin)->post(route('admin.communities.restore', $community->id));
        $this->assertNotSoftDeleted($community);
    }

    public function test_module_can_be_disabled(): void
    {
        $user = User::factory()->create();
        $community = $this->community($user);
        app(ModuleManager::class)->set('communities', false);

        $this->actingAs($user)->get(route('communities.index'))->assertNotFound();
        $this->actingAs($user)->get(route('communities.show', $community))->assertNotFound();
    }
}
